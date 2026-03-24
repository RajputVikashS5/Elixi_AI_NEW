import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { createRateLimiter } from './middleware/rateLimiter';
import { chatRoutes } from './routes/chat.routes';
import { automationRoutes } from './routes/automation.routes';
import { memoryRoutes } from './routes/memory.routes';
import { voiceRoutes } from './routes/voice.routes';
import { systemRoutes } from './routes/system.routes';
import { aiRoutes } from './routes/ai.routes';
import { setupSocketHandlers } from './services/socket.service';
import { initializeDatabase } from './services/memory.service';
import { logger } from './utils/logger';

const PORT = parseInt(process.env.PORT || '3001', 10);
const ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'];

async function bootstrap() {
  const app = express();
  const httpServer = createServer(app);

  // Initialize database
  await initializeDatabase();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: false, // Managed by Electron for desktop
  }));

  app.use(cors({
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
    credentials: true,
  }));

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(requestLogger);

  // Rate limiting per endpoint group
  app.use('/api/chat', createRateLimiter({ windowMs: 60_000, max: 60 }));
  app.use('/ai', createRateLimiter({ windowMs: 60_000, max: 60 }));
  app.use('/api/automation', createRateLimiter({ windowMs: 60_000, max: 30 }));
  app.use('/api/', createRateLimiter({ windowMs: 60_000, max: 200 }));

  // Routes
  app.use('/ai', aiRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/automation', automationRoutes);
  app.use('/api/memory', memoryRoutes);
  app.use('/api/voice', voiceRoutes);
  app.use('/api/system', systemRoutes);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
  });

  // Global error handler
  app.use(errorHandler);

  // Socket.io
  const io = new SocketServer(httpServer, {
    cors: {
      origin: ALLOWED_ORIGINS,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket'],
  });

  setupSocketHandlers(io);

  httpServer.listen(PORT, '127.0.0.1', () => {
    logger.info(`ELIXI Backend running on http://127.0.0.1:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start backend:', err);
  process.exit(1);
});
