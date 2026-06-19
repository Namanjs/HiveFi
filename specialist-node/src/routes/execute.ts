import { Router, Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { generateOllama } from '../models/ollama';
import { generateHuggingface } from '../models/huggingface';
import { verifyTaskEscrow, initializeBlockchain, signPaymentClaim, getWalletAddress } from '../blockchain';
import { ethers } from 'ethers';

const router = Router();

// Initialize blockchain when the router is loaded
initializeBlockchain().catch(console.error);

router.get('/health', (req: Request, res: Response) => {
  try {
    const wallet = getWalletAddress();
    res.json({
      status: 'ok',
      model_id: config.MODEL_ID,
      niche: config.NICHE,
      price_per_token: config.PRICE_PER_TOKEN,
      wallet: wallet
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/execute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prompt, niche, context, taskId, providerId } = req.body;

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

    if (taskId && providerId !== undefined) {
      const isValid = await verifyTaskEscrow(taskId, providerId, prompt);
      if (!isValid) {
        return res.status(402).json({
          error: `Payment Required. Task escrow verification failed on-chain. Cannot execute.`,
          code: 'PAYMENT_REQUIRED'
        });
      }
    } else {
      console.warn("No taskId or providerId provided! Generating response without escrow verification (dev mode?).");
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

    // 1. Calculate token count (naive estimation)
    // Strip whitespace to prevent padding attacks
    const promptLen = fullPrompt.replace(/\s/g, '').length;
    const resultLen = result.replace(/\s/g, '').length;
    const tokens = Math.ceil((promptLen + resultLen) / 4);

    // 2. Calculate final amount (in USDC decimals = 6)
    const pricePerTokenFloat = parseFloat(config.PRICE_PER_TOKEN);
    const finalAmountFloat = tokens * pricePerTokenFloat;
    const finalAmountBase = ethers.parseUnits(finalAmountFloat.toFixed(6), 6).toString();

    let signature = null;
    let resultHash = null;

    if (taskId) {
      // 3. Compute resultHash
      resultHash = ethers.keccak256(ethers.toUtf8Bytes(result));
      
      // 4. Sign the receipt
      signature = await signPaymentClaim(taskId, finalAmountBase, resultHash);
    }

    res.json({
      result: result,
      model_id: config.MODEL_ID,
      niche: config.NICHE,
      processing_time_ms: processingTimeMs,
      tokens: tokens,
      final_amount_base: finalAmountBase,
      signature: signature,
      result_hash: resultHash
    });

  } catch (error: any) {
    next(error);
  }
});

export default router;
