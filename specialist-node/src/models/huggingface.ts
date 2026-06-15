import { config } from '../config';

export async function generateHuggingface(prompt: string): Promise<string> {
  const url = `https://api-inference.huggingface.co/models/${config.MODEL_ID}`;
  const timeoutMs = config.HF_TIMEOUT_MS;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let finalPrompt = prompt;
  if (config.SYSTEM_PROMPT) {
    finalPrompt = `${config.SYSTEM_PROMPT}\n\n---\n\n${prompt}`;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: finalPrompt,
        parameters: {
          return_full_text: false,
          max_new_tokens: 1024
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Handle HuggingFace 503 Cold Start specifically
      if (response.status === 503 && errorData.estimated_time) {
        const err: any = new Error(`Model is currently loading. Estimated wait time: ${Math.ceil(errorData.estimated_time)} seconds.`);
        err.code = 'MODEL_LOADING';
        throw err;
      }

      throw new Error(errorData.error || `HuggingFace API error (${response.status})`);
    }

    const data = await response.json();
    
    if (Array.isArray(data) && data.length > 0 && data[0].generated_text) {
      return data[0].generated_text;
    } else if (data.generated_text) {
      return data.generated_text;
    }
    
    return JSON.stringify(data);
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.code === 'MODEL_LOADING') {
      throw error;
    }
    
    if (error.name === 'AbortError') {
      const err: any = new Error(`HuggingFace API request timed out after ${timeoutMs}ms.`);
      err.code = 'HUGGINGFACE_TIMEOUT';
      throw err;
    }

    const err: any = new Error(error.message || 'Failed to connect to HuggingFace API');
    err.code = 'HUGGINGFACE_ERROR';
    throw err;
  }
}
