import { config } from '../config';

export async function generateOllama(prompt: string): Promise<string> {
  const url = `${config.OLLAMA_BASE_URL.replace(/\/$/, '')}/api/generate`;
  const timeoutMs = config.OLLAMA_TIMEOUT_MS;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const requestBody: any = {
    model: config.MODEL_ID,
    prompt: prompt,
    stream: false,
    options: { num_predict: 8192 },
  };

  if (config.SYSTEM_PROMPT) {
    requestBody.system = config.SYSTEM_PROMPT;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.response || '';
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      const err: any = new Error(`Ollama API timed out after ${timeoutMs}ms. The model might still be loading into memory.`);
      err.code = 'OLLAMA_TIMEOUT';
      throw err;
    }
    
    const err: any = new Error(error.message || 'Failed to connect to Ollama');
    err.code = 'OLLAMA_ERROR';
    throw err;
  }
}
