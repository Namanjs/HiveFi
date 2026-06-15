import { Router, Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { generateOllama } from '../models/ollama';
import { generateHuggingface } from '../models/huggingface';
import { verifyTaskEscrow, initializeBlockchain } from '../blockchain';

const router = Router();

// Initialize blockchain when the router is loaded
initializeBlockchain().catch(console.error);

router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    model_id: config.MODEL_ID,
    niche: config.NICHE,
    price_per_query: config.PRICE_PER_QUERY,
    wallet: config.WALLET
  });
});

router.post('/execute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prompt, niche, context, taskId } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Missing required field: prompt', code: 'BAD_REQUEST' });
    }

    if (!niche) {
      return res.status(400).json({ error: 'Missing required field: niche', code: 'BAD_REQUEST' });
    }

    if (niche.toUpperCase() !== config.NICHE.toUpperCase()) {
      return res.status(400).json({
        error: `Niche mismatch. This node handles ${config.NICHE}, but received request for ${niche}`,
        code: 'NICHE_MISMATCH'
      });
    }

    if (taskId) {
      const isValid = await verifyTaskEscrow(taskId, config.WALLET, prompt);
      if (!isValid) {
        return res.status(402).json({
          error: `Payment Required. Task escrow verification failed on-chain. Cannot execute.`,
          code: 'PAYMENT_REQUIRED'
        });
      }
    } else {
      console.warn("No taskId provided! Generating response without escrow verification (dev mode?).");
    }

    const fullPrompt = context ? `${context}\n\n${prompt}` : prompt;
    
    const startTime = Date.now();
    
    let result = '';
    if (config.BACKEND === 'ollama') {
      result = await generateOllama(fullPrompt);
    } else if (config.BACKEND === 'huggingface') {
      result = await generateHuggingface(fullPrompt);
    }

    const processingTimeMs = Date.now() - startTime;

    res.json({
      result: result,
      model_id: config.MODEL_ID,
      niche: config.NICHE,
      processing_time_ms: processingTimeMs
    });

  } catch (error: any) {
    next(error);
  }
});

export default router;
