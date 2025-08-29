import { Redis } from 'ioredis';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  retryDelayOnFailover: number;
  maxRetriesPerRequest: number;
  connectTimeout: number;
  lazyConnect: boolean;
  keyPrefix?: string;
}

class RedisManager {
  private client: Redis | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;

  private getConfig(): RedisConfig {
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0', 10),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      connectTimeout: 10000, // 10 seconds
      lazyConnect: true,
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'ai_social_app:'
    };
  }

  async connect(): Promise<void> {
    if (this.isConnected && this.client) {
      logger.info('Redis already connected');
      return;
    }

    const config = this.getConfig();

    try {
      logger.info('Attempting to connect to Redis...', {
        host: config.host,
        port: config.port,
        db: config.db
      });

      this.client = new Redis(config);
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Test connection
      await this.client.ping();
      
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      logger.info('Successfully connected to Redis', {
        host: config.host,
        port: config.port,
        db: config.db,
        keyPrefix: config.keyPrefix
      });

    } catch (error) {
      this.isConnected = false;
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  private setupEventListeners(): void {
    if (!this.client) return;

    this.client.on('connect', () => {
      logger.info('Redis client connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready to receive commands');
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error:', error);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      logger.warn('Redis connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', (delay) => {
      this.reconnectAttempts++;
      logger.info(`Redis reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        logger.error('Maximum Redis reconnection attempts reached');
        this.client?.disconnect();
      }
    });

    this.client.on('end', () => {
      logger.warn('Redis connection ended');
      this.isConnected = false;
    });
  }

  getClient(): Redis {
    if (!this.client) {
      throw new Error('Redis client not initialized. Call connect() first.');
    }
    return this.client;
  }

  isConnectionReady(): boolean {
    return this.isConnected && this.client !== null && this.client.status === 'ready';
  }

  async disconnect(): Promise<void> {
    if (!this.client) {
      logger.info('Redis client not initialized, nothing to disconnect');
      return;
    }

    try {
      await this.client.quit();
      this.isConnected = false;
      this.client = null;
      logger.info('Disconnected from Redis');
    } catch (error) {
      logger.error('Error disconnecting from Redis:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: any;
  }> {
    try {
      if (!this.isConnectionReady()) {
        return {
          status: 'unhealthy',
          details: {
            connected: this.isConnected,
            clientStatus: this.client?.status || 'not_initialized',
            error: 'Redis connection not ready'
          }
        };
      }

      // Perform ping test
      const startTime = Date.now();
      const pong = await this.client!.ping();
      const responseTime = Date.now() - startTime;

      // Get server info
      const info = await this.client!.info();
      const memory = await this.client!.info('memory');
      const stats = await this.client!.info('stats');

      return {
        status: 'healthy',
        details: {
          connected: this.isConnected,
          clientStatus: this.client!.status,
          ping: pong,
          responseTime: responseTime,
          server: this.parseRedisInfo(info),
          memory: this.parseRedisInfo(memory),
          stats: this.parseRedisInfo(stats)
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          connected: this.isConnected,
          clientStatus: this.client?.status || 'not_initialized',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  private parseRedisInfo(info: string): any {
    const result: any = {};
    const lines = info.split('\r\n');
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        result[key] = isNaN(Number(value)) ? value : Number(value);
      }
    }
    
    return result;
  }

  // Cache operations with automatic serialization
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    if (!this.isConnectionReady()) {
      throw new Error('Redis connection not ready');
    }

    try {
      const serializedValue = JSON.stringify(value);
      
      if (ttlSeconds) {
        await this.client!.setex(key, ttlSeconds, serializedValue);
      } else {
        await this.client!.set(key, serializedValue);
      }
    } catch (error) {
      logger.error('Redis SET error:', { key, error });
      throw error;
    }
  }

  async get(key: string): Promise<any> {
    if (!this.isConnectionReady()) {
      throw new Error('Redis connection not ready');
    }

    try {
      const value = await this.client!.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis GET error:', { key, error });
      throw error;
    }
  }

  async del(key: string): Promise<number> {
    if (!this.isConnectionReady()) {
      throw new Error('Redis connection not ready');
    }

    try {
      return await this.client!.del(key);
    } catch (error) {
      logger.error('Redis DEL error:', { key, error });
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnectionReady()) {
      throw new Error('Redis connection not ready');
    }

    try {
      const result = await this.client!.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXISTS error:', { key, error });
      throw error;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    if (!this.isConnectionReady()) {
      throw new Error('Redis connection not ready');
    }

    try {
      const result = await this.client!.expire(key, ttlSeconds);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXPIRE error:', { key, ttlSeconds, error });
      throw error;
    }
  }

  async ttl(key: string): Promise<number> {
    if (!this.isConnectionReady()) {
      throw new Error('Redis connection not ready');
    }

    try {
      return await this.client!.ttl(key);
    } catch (error) {
      logger.error('Redis TTL error:', { key, error });
      throw error;
    }
  }

  // Hash operations
  async hset(key: string, field: string, value: any): Promise<number> {
    if (!this.isConnectionReady()) {
      throw new Error('Redis connection not ready');
    }

    try {
      const serializedValue = JSON.stringify(value);
      return await this.client!.hset(key, field, serializedValue);
    } catch (error) {
      logger.error('Redis HSET error:', { key, field, error });
      throw error;
    }
  }

  async hget(key: string, field: string): Promise<any> {
    if (!this.isConnectionReady()) {
      throw new Error('Redis connection not ready');
    }

    try {
      const value = await this.client!.hget(key, field);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis HGET error:', { key, field, error });
      throw error;
    }
  }

  async hgetall(key: string): Promise<any> {
    if (!this.isConnectionReady()) {
      throw new Error('Redis connection not ready');
    }

    try {
      const hash = await this.client!.hgetall(key);
      const result: any = {};
      
      for (const [field, value] of Object.entries(hash)) {
        try {
          result[field] = JSON.parse(value);
        } catch {
          result[field] = value;
        }
      }
      
      return result;
    } catch (error) {
      logger.error('Redis HGETALL error:', { key, error });
      throw error;
    }
  }

  async hdel(key: string, field: string): Promise<number> {
    if (!this.isConnectionReady()) {
      throw new Error('Redis connection not ready');
    }

    try {
      return await this.client!.hdel(key, field);
    } catch (error) {
      logger.error('Redis HDEL error:', { key, field, error });
      throw error;
    }
  }

  // List operations
  async lpush(key: string, ...values: any[]): Promise<number> {
    if (!this.isConnectionReady()) {
      throw new Error('Redis connection not ready');
    }

    try {
      const serializedValues = values.map(v => JSON.stringify(v));
      return await this.client!.lpush(key, ...serializedValues);
    } catch (error) {
      logger.error('Redis LPUSH error:', { key, error });
      throw error;
    }
  }

  async rpop(key: string): Promise<any> {
    if (!this.isConnectionReady()) {
      throw new Error('Redis connection not ready');
    }

    try {
      const value = await this.client!.rpop(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis RPOP error:', { key, error });
      throw error;
    }
  }

  async lrange(key: string, start: number, stop: number): Promise<any[]> {
    if (!this.isConnectionReady()) {
      throw new Error('Redis connection not ready');
    }

    try {
      const values = await this.client!.lrange(key, start, stop);
      return values.map(v => {
        try {
          return JSON.parse(v);
        } catch {
          return v;
        }
      });
    } catch (error) {
      logger.error('Redis LRANGE error:', { key, start, stop, error });
      throw error;
    }
  }

  // Set operations
  async sadd(key: string, ...members: any[]): Promise<number> {
    if (!this.isConnectionReady()) {
      throw new Error('Redis connection not ready');
    }

    try {
      const serializedMembers = members.map(m => JSON.stringify(m));
      return await this.client!.sadd(key, ...serializedMembers);
    } catch (error) {
      logger.error('Redis SADD error:', { key, error });
      throw error;
    }
  }

  async smembers(key: string): Promise<any[]> {
    if (!this.isConnectionReady()) {
      throw new Error('Redis connection not ready');
    }

    try {
      const members = await this.client!.smembers(key);
      return members.map(m => {
        try {
          return JSON.parse(m);
        } catch {
          return m;
        }
      });
    } catch (error) {
      logger.error('Redis SMEMBERS error:', { key, error });
      throw error;
    }
  }

  // Pub/Sub operations
  async publish(channel: string, message: any): Promise<number> {
    if (!this.isConnectionReady()) {
      throw new Error('Redis connection not ready');
    }

    try {
      const serializedMessage = JSON.stringify(message);
      return await this.client!.publish(channel, serializedMessage);
    } catch (error) {
      logger.error('Redis PUBLISH error:', { channel, error });
      throw error;
    }
  }

  // Batch operations
  async mget(keys: string[]): Promise<(any | null)[]> {
    if (!this.isConnectionReady()) {
      throw new Error('Redis connection not ready');
    }

    try {
      const values = await this.client!.mget(keys);
      return values.map(v => {
        try {
          return v ? JSON.parse(v) : null;
        } catch {
          return v;
        }
      });
    } catch (error) {
      logger.error('Redis MGET error:', { keys, error });
      throw error;
    }
  }

  async mset(keyValuePairs: Record<string, any>): Promise<void> {
    if (!this.isConnectionReady()) {
      throw new Error('Redis connection not ready');
    }

    try {
      const serializedPairs: string[] = [];
      for (const [key, value] of Object.entries(keyValuePairs)) {
        serializedPairs.push(key, JSON.stringify(value));
      }
      await this.client!.mset(...serializedPairs);
    } catch (error) {
      logger.error('Redis MSET error:', { keyValuePairs, error });
      throw error;
    }
  }

  // Pattern operations
  async keys(pattern: string): Promise<string[]> {
    if (!this.isConnectionReady()) {
      throw new Error('Redis connection not ready');
    }

    try {
      return await this.client!.keys(pattern);
    } catch (error) {
      logger.error('Redis KEYS error:', { pattern, error });
      throw error;
    }
  }

  // Utility methods
  async flushdb(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot flush database in production');
    }

    if (!this.isConnectionReady()) {
      throw new Error('Redis connection not ready');
    }

    try {
      await this.client!.flushdb();
      logger.warn('Redis database flushed');
    } catch (error) {
      logger.error('Redis FLUSHDB error:', error);
      throw error;
    }
  }

  async getMemoryUsage(): Promise<any> {
    if (!this.isConnectionReady()) {
      throw new Error('Redis connection not ready');
    }

    try {
      const info = await this.client!.info('memory');
      return this.parseRedisInfo(info);
    } catch (error) {
      logger.error('Redis memory usage error:', error);
      throw error;
    }
  }

  // Rate limiting helper
  async rateLimit(key: string, limit: number, windowSeconds: number): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    if (!this.isConnectionReady()) {
      throw new Error('Redis connection not ready');
    }

    const now = Math.floor(Date.now() / 1000);
    const window = Math.floor(now / windowSeconds);
    const rateLimitKey = `rate_limit:${key}:${window}`;

    try {
      const pipeline = this.client!.pipeline();
      pipeline.incr(rateLimitKey);
      pipeline.expire(rateLimitKey, windowSeconds);
      
      const results = await pipeline.exec();
      const currentCount = results?.[0]?.[1] as number;

      const allowed = currentCount <= limit;
      const remaining = Math.max(0, limit - currentCount);
      const resetTime = (window + 1) * windowSeconds;

      return {
        allowed,
        remaining,
        resetTime
      };
    } catch (error) {
      logger.error('Redis rate limit error:', { key, error });
      throw error;
    }
  }
}

// Create singleton instance
const redisManager = new RedisManager();

// Export initialization function
export const initializeRedis = async (): Promise<void> => {
  await redisManager.connect();
};

// Export client getter
export const getRedisClient = (): Redis => {
  return redisManager.getClient();
};

// Export other useful functions
export const isRedisConnected = () => redisManager.isConnectionReady();
export const getRedisHealthCheck = () => redisManager.healthCheck();
export const disconnectRedis = () => redisManager.disconnect();

export default redisManager;
