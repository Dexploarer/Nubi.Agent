import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { logger } from './utils/logger';
import { healthRouter } from './api/health';
import { agentRouter } from './api/agent';
import { analyticsRouter } from './api/analytics';
import { initializeServices } from './services';
import { IntegrationManager } from './services/integration-manager';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/health', healthRouter);
app.use('/api/v1/agent', agentRouter);
app.use('/api/v1/analytics', analyticsRouter);

// Initialize Integration Manager (connects Supabase + Socket.IO)
const integrationManager = new IntegrationManager(io);

// Make integration manager available globally
(global as any).integrationManager = integrationManager;

// Initialize services
async function start() {
  try {
    await initializeServices();
    
    const PORT = process.env.PORT || 8080;
    httpServer.listen(PORT, () => {
      logger.info(`NUBI Agent running on port ${PORT}`);
      logger.info('Supabase Edge Functions: ' + (process.env.SUPABASE_URL ? 'Connected' : 'Disabled'));
      logger.info('Socket.IO: Enabled on port ' + PORT);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

start();
