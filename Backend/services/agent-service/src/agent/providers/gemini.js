// Gemini provider — presents the SAME interface as the Anthropic client
// (`.messages.create` and `.messages.stream(...).on('text').finalMessage()`) so
// the ReAct loop works unchanged. All Anthropic<->Gemini shape translation lives
// in translate.js; this file is only the SDK glue.
const { toGeminiTools, toGeminiContents, toAnthropicMessage } = require('./translate');

// Pull functionCall parts out of a response (or a stream chunk), preserving each
// part's thoughtSignature. Gemini 3 attaches an opaque thoughtSignature to every
// functionCall it emits and REQUIRES it back, verbatim, on that same functionCall
// part in the next turn — otherwise it rejects the follow-up with 400 "Function
// call is missing a thought_signature in functionCall parts". The convenience
// `.functionCalls` getter drops the signature, so we read the raw candidate parts
// when the SDK gives them to us, and fall back to the getter otherwise (injected
// test doubles model `.functionCalls` directly and carry no candidates).
function functionCallsWithSignatures(resp) {
  const parts = resp?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const calls = [];
    for (const p of parts) {
      if (!p.functionCall) continue;
      calls.push(
        p.thoughtSignature
          ? { ...p.functionCall, thoughtSignature: p.thoughtSignature }
          : { ...p.functionCall }
      );
    }
    return calls;
  }
  return resp?.functionCalls || [];
}

// Turn a raw @google/genai SDK error into a short, human-readable Error. The SDK
// surfaces failures as a JSON blob in `err.message` (code, status, nested detail
// objects) — dumped straight into the chat panel it's unreadable. We parse it and
// give a plain sentence, with special-casing for the one users actually hit: 429
// RESOURCE_EXHAUSTED (free-tier requests/minute), including the API's retry hint.
function cleanGeminiError(err) {
  const raw = err && err.message ? String(err.message) : String(err);
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const brace = raw.indexOf('{');
    if (brace !== -1) {
      try {
        parsed = JSON.parse(raw.slice(brace));
      } catch {
        /* not JSON — leave parsed null, fall through to raw text */
      }
    }
  }

  const info = (parsed && parsed.error) || parsed || {};
  const code = info.code || err?.status || err?.code;
  const status = info.status;
  const apiMessage = info.message;

  if (code === 429 || status === 'RESOURCE_EXHAUSTED') {
    let retry = '';
    const details = Array.isArray(info.details) ? info.details : [];
    const retryInfo = details.find((d) => String(d['@type'] || '').includes('RetryInfo'));
    if (retryInfo && retryInfo.retryDelay) {
      retry = ` Please retry in ~${retryInfo.retryDelay}.`;
    } else {
      const m = /retry in ([\d.]+)s/i.exec(apiMessage || '');
      if (m) retry = ` Please retry in ~${Math.ceil(Number(m[1]))}s.`;
    }
    const e = new Error(
      `Rate limit reached on the Gemini free tier (only a few requests per minute, and one agent question uses several).${retry}`
    );
    e.status = 429;
    e.code = 'rate_limited';
    return e;
  }

  if (apiMessage) {
    const e = new Error(`Gemini error${code ? ` (${code})` : ''}: ${apiMessage}`);
    if (code) e.status = code;
    return e;
  }

  return err; // unrecognised shape — pass the original through untouched
}

class GeminiClient {
  // `genai` is an injectable @google/genai instance (tests); otherwise the real
  // SDK is loaded lazily via dynamic import (it is ESM-only).
  constructor({ apiKey, genai } = {}) {
    this._apiKey = apiKey;
    this._injected = genai || null;
    this._instance = null;
    this.messages = {
      create: (params) => this._create(params),
      stream: (params) => this._stream(params),
    };
  }

  async _ai() {
    if (this._instance) return this._instance;
    if (this._injected) {
      this._instance = this._injected;
      return this._instance;
    }
    const { GoogleGenAI } = await import('@google/genai');
    this._instance = new GoogleGenAI({ apiKey: this._apiKey });
    return this._instance;
  }

  _request(params) {
    return {
      model: params.model,
      contents: toGeminiContents(params.messages),
      config: {
        systemInstruction: params.system,
        maxOutputTokens: params.max_tokens,
        tools: toGeminiTools(params.tools),
      },
    };
  }

  async _create(params) {
    const ai = await this._ai();
    let resp;
    try {
      resp = await ai.models.generateContent(this._request(params));
    } catch (err) {
      throw cleanGeminiError(err);
    }
    return toAnthropicMessage({
      text: resp.text,
      functionCalls: functionCallsWithSignatures(resp),
      usage: resp.usageMetadata,
    });
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
        const ai = await self._ai();
        let text = '';
        let usage;
        const functionCalls = [];
        try {
          const stream = await ai.models.generateContentStream(self._request(params));
          for await (const chunk of stream) {
            if (chunk.text) {
              text += chunk.text;
              textCb(chunk.text);
            }
            // Gemini reports usage only on the final chunk(s) — keep the last
            // one we see rather than assuming it arrives anywhere in particular.
            if (chunk.usageMetadata) usage = chunk.usageMetadata;
            for (const fc of functionCallsWithSignatures(chunk)) functionCalls.push(fc);
          }
        } catch (err) {
          throw cleanGeminiError(err);
        }
        return toAnthropicMessage({ text, functionCalls, usage });
      },
    };
    return api;
  }
}

module.exports = { GeminiClient, cleanGeminiError };
