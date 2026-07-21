// The provider fallback chain: try each provider in order, move to the next when
// one fails. A doctor's question should not die because the free tier hit its
// per-minute limit.
//
// ⚠️ THE STREAMING RULE. Falling back mid-stream is only safe while NOTHING has
// been emitted yet. Once tokens have reached the panel, switching providers would
// replay a second, different answer on top of the first — so past that point the
// error is rethrown and the run fails honestly instead of producing garbled text.
//
// Each link owns its own model name. The chain substitutes it per attempt,
// because "claude-sonnet-5" is meaningless to Gemini and vice versa.

// Which failures are worth trying the next provider for?
//   429 / 5xx / network  — this provider is busy or broken; another may work.
//   401 / 403            — this provider is misconfigured (missing or bad key);
//                          that is precisely when the fallback should earn its keep.
//   4xx (400, 422, ...)  — WE sent something invalid. Every provider will reject
//                          it the same way, so failing over just wastes calls and
//                          hides the real bug.
function isWorthRetrying(err) {
  const status = err?.status ?? err?.statusCode;
  if (status === undefined || status === null) return true; // network/DNS/timeout
  if (status === 429 || status === 408 || status === 409) return true;
  if (status === 401 || status === 403) return true;
  return status >= 500;
}

const describe = (err) => `${err?.status ? `${err.status} ` : ''}${err?.message || err}`;

/**
 * @param {Array<{provider, model, client}>} links  tried in order
 * @param {function} [onFallback]  (from, to, err) => void — for logging/tracing
 */
function createFallbackClient(links, onFallback = () => {}) {
  if (!links.length) throw new Error('A provider chain needs at least one provider');

  // Each attempt runs with that link's own model.
  const paramsFor = (link, params) => ({ ...params, model: link.model });

  async function attempt(run, { streaming = false } = {}) {
    const failures = [];

    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      try {
        return await run(link);
      } catch (err) {
        failures.push(`${link.provider}: ${describe(err)}`);

        const last = i === links.length - 1;
        const unsafe = streaming && err.emittedText;
        if (last || unsafe || !isWorthRetrying(err)) {
          // Attach the whole story so the panel shows why, not just the last hop.
          if (failures.length > 1) {
            err.message = `All providers failed — ${failures.join(' | ')}`;
          }
          throw err;
        }

        onFallback(link.provider, links[i + 1].provider, err);
        console.warn(
          `[provider] ${link.provider} failed (${describe(err)}) — falling back to ${links[i + 1].provider}`
        );
      }
    }
    /* unreachable: the loop either returns or throws */
  }

  return {
    // What the chain is, for logging and the trace.
    chain: links.map((l) => ({ provider: l.provider, model: l.model })),

    messages: {
      create: (params) => attempt((link) => link.client.messages.create(paramsFor(link, params))),

      stream: (params) => {
        let textCb = () => {};
        const api = {
          on(event, cb) {
            if (event === 'text' && typeof cb === 'function') textCb = cb;
            return api;
          },
          finalMessage: () =>
            attempt(
              async (link) => {
                let emitted = false;
                const underlying = link.client.messages.stream(paramsFor(link, params));
                underlying.on('text', (delta) => {
                  emitted = true;
                  textCb(delta);
                });
                try {
                  return await underlying.finalMessage();
                } catch (err) {
                  // Mark it so the chain knows this failure is no longer safe to
                  // recover from — the doctor has already seen part of an answer.
                  if (emitted) err.emittedText = true;
                  throw err;
                }
              },
              { streaming: true }
            ),
        };
        return api;
      },
    },
  };
}

module.exports = { createFallbackClient, isWorthRetrying };
