import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import routes from './routes/execute';

const app = express();

app.use(express.json());

const apiLimiter = rateLimit({ windowMs: 60000, max: 20 });
app.use(apiLimiter);

// Auth Middleware
app.use((req: Request, res: Response, next: NextFunction): any => {
  if (req.path === '/health') {
    return next();
  }
  const secret = req.headers['x-auth-secret'];
  if (!secret || secret !== config.AUTH_SECRET) {
    return res.status(401).json({ error: 'Unauthorized specialist access', code: 'UNAUTHORIZED' });
  }
  next();
});

// Main routes
app.use('/', routes);

// Global Error Handler - Ensure we never dump raw Express errors
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.status || 500;
  const message = err.message || 'Internal Server Error';
  const code = err.code || 'INTERNAL_ERROR';

  res.status(statusCode).json({
    error: message,
    code: code
  });
});

app.listen(config.PORT, () => {
  console.log(`HiveFi Specialist Node running on port ${config.PORT}`);
  console.log(`- Niche: ${config.NICHE}`);
  console.log(`- Model: ${config.MODEL_ID}`);
  console.log(`- Backend: ${config.BACKEND}`);
});
