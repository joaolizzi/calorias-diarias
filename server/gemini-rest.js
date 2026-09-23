const DEFAULT_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
];

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS_PER_MODEL = 2;
const PER_ATTEMPT_TIMEOUT_MS = 8_000;

function uniqueModels(primary) {
  return [...new Set([primary, ...DEFAULT_MODELS].filter(Boolean))];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

function extractText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((part) => part?.text || '').join('').trim();
}

function buildError(status, payload, model) {
  const message = payload?.error?.message || payload?.message || `Gemini HTTP ${status}`;
  const error = new Error(`${message} [model=${model}]`);
  error.status = status;
  error.model = model;
  error.providerMessage = message;
  return error;
}

function isTemporaryError(error) {
  const message = String(error?.providerMessage || error?.message || '');
  return RETRYABLE_STATUS.has(Number(error?.status)) || /high demand|overloaded|temporar|try again|resource exhausted|capacity|unavailable/i.test(message);
}

function shouldTryFallback(error) {
  const message = String(error?.providerMessage || error?.message || '');
  return error?.status === 404 || isTemporaryError(error) || /model|not found|unsupported|deprecated/i.test(message);
}

function markTemporaryUnavailable(error) {
  if (isTemporaryError(error)) {
    error.code = 'AI_TEMPORARILY_UNAVAILABLE';
    error.publicMessage = 'A IA está temporariamente sobrecarregada. Tente novamente em alguns segundos.';
  }
  return error;
}

export async function generateGemini({
  parts,
  model = process.env.GEMINI_MODEL,
  timeoutMs = 25_000,
  temperature = 0.1,
  responseMimeType = 'application/json',
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const error = new Error('GEMINI_API_KEY não configurada no servidor');
    error.status = 500;
    error.publicMessage = 'A IA não está configurada no servidor.';
    throw error;
  }

  const normalizedParts = Array.isArray(parts) ? parts : [{ text: String(parts || '') }];
  const models = uniqueModels(model);
  const deadline = Date.now() + Math.max(5_000, timeoutMs);
  let lastError = null;

  for (const candidateModel of models) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt += 1) {
      const remaining = deadline - Date.now();
      if (remaining < 900) break;

      const attemptTimeout = Math.min(PER_ATTEMPT_TIMEOUT_MS, Math.max(700, remaining - 250));
      const timer = timeoutSignal(attemptTimeout);

      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidateModel)}:generateContent`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: normalizedParts }],
            generationConfig: {
              temperature,
              responseMimeType,
            },
          }),
          signal: timer.signal,
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw buildError(response.status, payload, candidateModel);

        const text = extractText(payload);
        if (!text) {
          const error = new Error(`Resposta vazia do Gemini [model=${candidateModel}]`);
          error.status = 502;
          error.model = candidateModel;
          throw error;
        }

        return { text, model: candidateModel, attempt };
      } catch (error) {
        if (error?.name === 'AbortError') {
          const timeoutError = new Error(`Tempo limite da IA excedido [model=${candidateModel}]`);
          timeoutError.status = 504;
          timeoutError.model = candidateModel;
          timeoutError.providerMessage = 'request timeout';
          lastError = timeoutError;
        } else {
          lastError = error;
        }

        const temporary = isTemporaryError(lastError);
        if (temporary && attempt < MAX_ATTEMPTS_PER_MODEL && deadline - Date.now() > 1_200) {
          await sleep(attempt === 1 ? 300 : 700);
          continue;
        }

        break;
      } finally {
        timer.cancel();
      }
    }

    if (!shouldTryFallback(lastError)) break;
  }

  throw markTemporaryUnavailable(lastError || new Error('Falha ao chamar Gemini'));
}
