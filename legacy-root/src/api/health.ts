import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

healthRouter.get('/ready', async (req, res) => {
  // Check database connections, etc.
  res.json({ ready: true });
});

healthRouter.get('/live', (req, res) => {
  res.json({ alive: true });
});
