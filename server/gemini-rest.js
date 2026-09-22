const DEFAULT_MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash'];

function uniqueModels(primary) {
  return [...new Set([primary, ...DEFAULT_MODELS].filter(Boolean))];
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
  return error;
}

function shouldTryFallback(error) {
  const message = String(error?.message || '');
  return error?.status === 404 || /model|not found|unsupported|unavailable|deprecated/i.test(message);
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
    throw error;
  }

  const normalizedParts = Array.isArray(parts) ? parts : [{ text: String(parts || '') }];
  const models = uniqueModels(model);
  let lastError = null;

  for (const candidateModel of models) {
    const timer = timeoutSignal(timeoutMs);
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
        throw error;
      }

      return { text, model: candidateModel };
    } catch (error) {
      if (error?.name === 'AbortError') {
        const timeoutError = new Error(`Tempo limite da IA excedido [model=${candidateModel}]`);
        timeoutError.status = 504;
        lastError = timeoutError;
      } else {
        lastError = error;
      }

      if (!shouldTryFallback(lastError)) break;
    } finally {
      timer.cancel();
    }
  }

  throw lastError || new Error('Falha ao chamar Gemini');
}
