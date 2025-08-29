import mongoose from 'mongoose';
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

interface MongoConfig {
  uri: string;
  options: mongoose.ConnectOptions;
}

class MongoDBManager {
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectInterval: number = 5000; // 5 seconds

  private getConfig(): MongoConfig {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-social-app';
    
    const options: mongoose.ConnectOptions = {
      // Connection settings
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      bufferMaxEntries: 0, // Disable mongoose buffering
      bufferCommands: false, // Disable mongoose buffering
      
      // Performance optimizations
      maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
      
      // Reliability settings
      retryWrites: true,
      retryReads: true,
      
      // Authentication (if needed)
      ...(process.env.MONGODB_USERNAME && process.env.MONGODB_PASSWORD ? {
        authSource: process.env.MONGODB_AUTH_SOURCE || 'admin',
        auth: {
          username: process.env.MONGODB_USERNAME,
          password: process.env.MONGODB_PASSWORD
        }
      } : {})
    };

    return { uri: mongoUri, options };
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      logger.info('MongoDB already connected');
      return;
    }

    const { uri, options } = this.getConfig();

    try {
      logger.info('Attempting to connect to MongoDB...');
      
      await mongoose.connect(uri, options);
      
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      logger.info('Successfully connected to MongoDB', {
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name
      });

      // Set up event listeners
      this.setupEventListeners();
      
      // Set up graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      this.isConnected = false;
      logger.error('Failed to connect to MongoDB:', error);
      
      // Attempt reconnection
      await this.handleReconnection();
      
      throw error;
    }
  }

  private setupEventListeners(): void {
    const connection = mongoose.connection;

    connection.on('connected', () => {
      logger.info('Mongoose connected to MongoDB');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    connection.on('error', (error) => {
      logger.error('MongoDB connection error:', error);
      this.isConnected = false;
    });

    connection.on('disconnected', () => {
      logger.warn('Mongoose disconnected from MongoDB');
      this.isConnected = false;
      
      // Attempt reconnection if not intentionally disconnected
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.handleReconnection();
      }
    });

    connection.on('reconnected', () => {
      logger.info('Mongoose reconnected to MongoDB');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    // Handle replica set events
    connection.on('fullsetup', () => {
      logger.info('MongoDB replica set fully connected');
    });

    connection.on('all', () => {
      logger.info('Connected to all MongoDB servers in replica set');
    });
  }

  private async handleReconnection(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Maximum reconnection attempts reached. Giving up.');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectInterval * this.reconnectAttempts;

    logger.info(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    setTimeout(async () => {
      try {
        const { uri, options } = this.getConfig();
        await mongoose.connect(uri, options);
        logger.info('Reconnection successful');
      } catch (error) {
        logger.error('Reconnection failed:', error);
        await this.handleReconnection();
      }
    }, delay);
  }

  private setupGracefulShutdown(): void {
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful MongoDB shutdown...`);
      
      try {
        await mongoose.connection.close();
        logger.info('MongoDB connection closed successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during MongoDB shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      logger.info('MongoDB not connected, nothing to disconnect');
      return;
    }

    try {
      await mongoose.connection.close();
      this.isConnected = false;
      logger.info('Disconnected from MongoDB');
    } catch (error) {
      logger.error('Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  getConnection(): typeof mongoose.connection {
    return mongoose.connection;
  }

  isConnectionReady(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
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
            readyState: mongoose.connection.readyState,
            error: 'Database connection not ready'
          }
        };
      }

      // Perform a simple ping
      const adminDb = mongoose.connection.db.admin();
      const result = await adminDb.ping();
      
      const stats = await mongoose.connection.db.stats();
      
      return {
        status: 'healthy',
        details: {
          connected: this.isConnected,
          readyState: mongoose.connection.readyState,
          host: mongoose.connection.host,
          port: mongoose.connection.port,
          name: mongoose.connection.name,
          ping: result,
          stats: {
            collections: stats.collections,
            dataSize: stats.dataSize,
            storageSize: stats.storageSize,
            indexes: stats.indexes
          }
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          connected: this.isConnected,
          readyState: mongoose.connection.readyState,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  // Database operations helpers
  async createIndexes(): Promise<void> {
    try {
      logger.info('Creating database indexes...');
      
      // This will trigger index creation for all models
      const models = mongoose.models;
      
      for (const modelName in models) {
        const model = models[modelName];
        await model.ensureIndexes();
        logger.info(`Indexes ensured for ${modelName}`);
      }
      
      logger.info('All database indexes created successfully');
    } catch (error) {
      logger.error('Error creating database indexes:', error);
      throw error;
    }
  }

  async dropDatabase(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot drop database in production');
    }

    try {
      await mongoose.connection.dropDatabase();
      logger.warn('Database dropped successfully');
    } catch (error) {
      logger.error('Error dropping database:', error);
      throw error;
    }
  }

  // Get database statistics
  async getDatabaseStats(): Promise<any> {
    try {
      const stats = await mongoose.connection.db.stats();
      const collections = await mongoose.connection.db.collections();
      
      const collectionStats = await Promise.all(
        collections.map(async (collection) => {
          const collStats = await collection.stats();
          return {
            name: collection.collectionName,
            count: collStats.count,
            size: collStats.size,
            avgObjSize: collStats.avgObjSize,
            storageSize: collStats.storageSize,
            indexes: collStats.nindexes
          };
        })
      );

      return {
        database: {
          name: mongoose.connection.name,
          collections: stats.collections,
          objects: stats.objects,
          dataSize: stats.dataSize,
          storageSize: stats.storageSize,
          indexes: stats.indexes,
          indexSize: stats.indexSize
        },
        collections: collectionStats
      };
    } catch (error) {
      logger.error('Error getting database stats:', error);
      throw error;
    }
  }

  // Monitoring and maintenance
  async getSlowQueries(threshold: number = 100): Promise<any[]> {
    try {
      // Enable profiling if not already enabled
      await mongoose.connection.db.command({
        profile: 2,
        slowms: threshold
      });

      const profiler = mongoose.connection.db.collection('system.profile');
      const slowQueries = await profiler
        .find({ millis: { $gt: threshold } })
        .sort({ ts: -1 })
        .limit(50)
        .toArray();

      return slowQueries;
    } catch (error) {
      logger.error('Error getting slow queries:', error);
      throw error;
    }
  }

  async optimizeCollections(): Promise<void> {
    try {
      logger.info('Starting collection optimization...');
      
      const collections = await mongoose.connection.db.collections();
      
      for (const collection of collections) {
        try {
          await collection.reIndex();
          logger.info(`Optimized indexes for ${collection.collectionName}`);
        } catch (error) {
          logger.error(`Error optimizing ${collection.collectionName}:`, error);
        }
      }
      
      logger.info('Collection optimization completed');
    } catch (error) {
      logger.error('Error during collection optimization:', error);
      throw error;
    }
  }
}

// Create singleton instance
const mongoManager = new MongoDBManager();

// Export initialization function
export const initializeMongoDB = async (): Promise<void> => {
  await mongoManager.connect();
  await mongoManager.createIndexes();
};

// Export other useful functions
export const getMongoConnection = () => mongoManager.getConnection();
export const isMongoConnected = () => mongoManager.isConnectionReady();
export const getMongoHealthCheck = () => mongoManager.healthCheck();
export const getMongoStats = () => mongoManager.getDatabaseStats();

export default mongoManager;
