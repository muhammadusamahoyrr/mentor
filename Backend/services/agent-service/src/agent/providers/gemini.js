// Gemini provider — presents the SAME interface as the Anthropic client
// (`.messages.create` and `.messages.stream(...).on('text').finalMessage()`) so
// the ReAct loop works unchanged. All Anthropic<->Gemini shape translation lives
// in translate.js; this file is only the SDK glue.
const { toGeminiTools, toGeminiContents, toAnthropicMessage } = require('./translate');

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
    const resp = await ai.models.generateContent(this._request(params));
    return toAnthropicMessage({ text: resp.text, functionCalls: resp.functionCalls || [] });
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
        const stream = await ai.models.generateContentStream(self._request(params));
        let text = '';
        const functionCalls = [];
        for await (const chunk of stream) {
          if (chunk.text) {
            text += chunk.text;
            textCb(chunk.text);
          }
          for (const fc of chunk.functionCalls || []) functionCalls.push(fc);
        }
        return toAnthropicMessage({ text, functionCalls });
      },
    };
    return api;
  }
}

module.exports = { GeminiClient };
