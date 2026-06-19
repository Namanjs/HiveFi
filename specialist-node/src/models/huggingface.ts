import { config } from '../config';
import { HfInference } from '@huggingface/inference';

export async function generateHuggingface(prompt: string): Promise<string> {
  const hf = new HfInference(config.HUGGINGFACE_API_KEY);
  
  let finalPrompt = prompt;
  if (config.SYSTEM_PROMPT) {
    finalPrompt = `${config.SYSTEM_PROMPT}\n\n---\n\n${prompt}`;
  }

  try {
    // The official SDK automatically handles the new Inference Provider routing in 2026
    const response = await hf.chatCompletion({
      model: config.MODEL_ID,
      messages: [{ role: "user", content: finalPrompt }],
      max_tokens: 1024,
    });

    if (response.choices && response.choices.length > 0) {
      return response.choices[0].message.content || "";
    }
    
    return JSON.stringify(response);
  } catch (error: any) {
    console.error("Hugging Face API Error:", error);
    
    if (error.message?.includes('loading') || error.message?.includes('503')) {
      const err: any = new Error(`Model is currently loading. Please wait and try again.`);
      err.code = 'MODEL_LOADING';
      throw err;
    }

    const err: any = new Error(error.message || 'Failed to connect to HuggingFace API');
    err.code = 'HUGGINGFACE_ERROR';
    throw err;
  }
}
