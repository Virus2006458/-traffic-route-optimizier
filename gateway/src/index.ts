import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import routeRoutes from './routes/route.routes';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 15s request timeout middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setTimeout(15000, () => {
    res.status(504).json({
      status: 'error',
      message: 'Request timed out after 15 seconds. Please try again.'
    });
  });
  next();
});

// Basic rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // max 120 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests, please slow down.' }
});

app.use('/api', limiter);
app.use('/api', routeRoutes);

app.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Traffic Route Optimization Gateway API',
    version: '1.0.0',
    documentation: '/api/health'
  });
});

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ status: 'error', message: 'Endpoint not found' });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Unhandled Gateway Error]', err);
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal gateway server error'
  });
});

app.listen(config.port, () => {
  console.log(`==================================================`);
  console.log(` Gateway API running on http://localhost:${config.port}`);
  console.log(` Engine URL: ${config.engineUrl}`);
  console.log(` TomTom Key Configured: ${Boolean(config.tomtomApiKey)}`);
  console.log(`==================================================`);
});

export default app;
