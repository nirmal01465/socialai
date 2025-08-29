import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Redis } from 'ioredis';
import winston from 'winston';

// Import routes
import authRoutes from './routes/auth.ts';
import feedRoutes from './routes/feed.ts';
import aiRoutes from './routes/ai.ts';
import socialRoutes from './routes/social.ts';

// Import middleware
import { authMiddleware } from './middleware/auth.ts';
import { rateLimitMiddleware } from './middleware/rateLimit.ts';
import { securityMiddleware } from './middleware/security.ts';

// Import services
import { initializeMongoDB } from './database/mongodb.ts';
import { initializeRedis } from './database/redis.ts';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
}));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5000',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(rateLimitMiddleware);
app.use(securityMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/feed', authMiddleware, feedRoutes);
app.use('/api/ai', authMiddleware, aiRoutes);
app.use('/api/social', authMiddleware, socialRoutes);

// WebSocket server for real-time features
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

interface ExtendedWebSocket extends import('ws').WebSocket {
  userId?: string;
  isAlive?: boolean;
}

wss.on('connection', (ws: ExtendedWebSocket, req) => {
  logger.info('New WebSocket connection established');
  
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  
  ws.on('message', async (message: Buffer) => {
    try {
      const data = JSON.parse(message.toString());
      
      switch (data.type) {
        case 'authenticate':
          // Authenticate WebSocket connection
          ws.userId = data.userId;
          ws.send(JSON.stringify({ type: 'authenticated', success: true }));
          break;
          
        case 'behavior_event':
          // Handle real-time behavior tracking
          logger.info('Behavior event received:', data.event);
          break;
          
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
          
        default:
          logger.warn('Unknown WebSocket message type:', data.type);
      }
    } catch (error) {
      logger.error('WebSocket message error:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });
  
  ws.on('close', () => {
    logger.info('WebSocket connection closed');
  });
  
  ws.on('error', (error) => {
    logger.error('WebSocket error:', error);
  });
});

// Heartbeat to keep connections alive
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws: ExtendedWebSocket) => {
    if (!ws.isAlive) {
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(heartbeat);
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize database connections
async function initializeApp() {
  try {
    await initializeMongoDB();
    await initializeRedis();
    
    const PORT = parseInt(process.env.PORT || '8000');
    httpServer.listen(PORT, 'localhost', () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`WebSocket server available at ws://localhost:${PORT}/ws`);
    });
  } catch (error) {
    logger.error('Failed to initialize application:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    mongoose.connection.close();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  httpServer.close(() => {
    mongoose.connection.close();
    process.exit(0);
  });
});

initializeApp();

export { app, wss };
