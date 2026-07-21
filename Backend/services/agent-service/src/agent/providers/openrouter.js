// OpenRouter provider — presents the SAME interface as the Anthropic client
// (`.messages.create` and `.messages.stream(...).on('text').finalMessage()`) so
// the ReAct loop works unchanged. All shape translation lives in
// openrouterTranslate.js; this file is only the HTTP glue.
//
// OpenRouter is one key in front of many models (including free ones), which is
// why it earns its place in the fallback chain: when the primary provider is
// rate-limited, this is the most likely thing to still answer.
//
// Raw fetch rather than the OpenAI SDK: the API is a single REST endpoint, the
// rest of this codebase already calls services with global fetch, and it keeps
// one more dependency out of the tree.
const {
  toOpenAITools,
  toOpenAIMessages,
  toAnthropicMessage,
  mergeToolCallDeltas,
} = require('./openrouterTranslate');

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

// Turn a failed OpenRouter response into an Error carrying `status`, which is
// what the fallback chain reads to decide whether to try the next provider.
async function toError(res) {
  let detail = '';
  try {
    const body = await res.json();
    detail = body?.error?.message || body?.message || '';
  } catch {
    /* non-JSON error body — the status alone is the signal */
  }

  const err = new Error(
    res.status === 429
      ? `OpenRouter rate limit reached.${detail ? ` ${detail}` : ''}`
      : `OpenRouter error (${res.status})${detail ? `: ${detail}` : ''}`
  );
  err.status = res.status;
  if (res.status === 429) err.code = 'rate_limited';
  return err;
}

// OpenRouter asks callers to identify themselves; these are optional but
// recommended and show up in the dashboard.
function headers(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:3000',
    'X-Title': process.env.OPENROUTER_APP_NAME || 'CareLoop clinical research agent',
  };
}

class OpenRouterClient {
  constructor({ apiKey, endpoint } = {}) {
    this._apiKey = apiKey;
    this._endpoint = endpoint || ENDPOINT;
    this.messages = {
      create: (params) => this._create(params),
      stream: (params) => this._stream(params),
    };
  }

  _body(params, stream) {
    const body = {
      model: params.model,
      messages: toOpenAIMessages(params.messages, params.system),
      max_tokens: params.max_tokens,
    };
    const tools = toOpenAITools(params.tools);
    if (tools) body.tools = tools;
    if (stream) body.stream = true;
    return body;
  }

  _assertKey() {
    if (!this._apiKey) {
      const err = new Error('OPENROUTER_API_KEY is not set');
      err.status = 401;
      throw err;
    }
  }

  async _create(params) {
    this._assertKey();
    const res = await fetch(this._endpoint, {
      method: 'POST',
      headers: headers(this._apiKey),
      body: JSON.stringify(this._body(params, false)),
    });
    if (!res.ok) throw await toError(res);

    const data = await res.json();
    return toAnthropicMessage(data.choices?.[0]?.message || {}, data.usage);
  }

  _stream(params) {
    const self = this;
    let textCb = () => {};

    const api = {
      on(event, cb) {
        if (event === 'text' && typeof cb === 'function') textCb = cb;
        return api;
      },
      finalMessage: async () => {
        self._assertKey();
        const res = await fetch(self._endpoint, {
          method: 'POST',
          headers: headers(self._apiKey),
          body: JSON.stringify(self._body(params, true)),
        });
        if (!res.ok) throw await toError(res);
        if (!res.body) throw new Error('OpenRouter returned no response body to stream');

        let text = '';
        let usage;
        const toolCalls = [];
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // SSE frames are separated by a blank line; a frame may span reads.
          let idx;
          while ((idx = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 1);
            if (!line.startsWith('data:')) continue;

            const payload = line.slice(5).trim();
            if (payload === '[DONE]') continue;

            let chunk;
            try {
              chunk = JSON.parse(payload);
            } catch {
              continue; // a partial/keep-alive frame — wait for the next one
            }

            // Usage rides on a late chunk (often the one after the last delta).
            if (chunk.usage) usage = chunk.usage;

            const delta = chunk.choices?.[0]?.delta;
            if (!delta) continue;
            if (delta.content) {
              text += delta.content;
              textCb(delta.content);
            }
            if (delta.tool_calls) mergeToolCallDeltas(toolCalls, delta.tool_calls);
          }
        }

        return toAnthropicMessage({ content: text, tool_calls: toolCalls.filter(Boolean) }, usage);
      },
    };

    return api;
  }
}

module.exports = { OpenRouterClient, toError, ENDPOINT };
