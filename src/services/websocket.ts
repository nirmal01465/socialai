import { store } from '../store';
import { updateConnectedStatus } from '../store/slices/uiSlice';

interface WebSocketMessage {
  type: string;
  data?: any;
  userId?: string;
  timestamp?: string;
}

interface WebSocketConfig {
  reconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  debug?: boolean;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 5000; // 5 seconds
  private heartbeatInterval = 30000; // 30 seconds
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private isIntentionallyClosed = false;
  private debug = false;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private eventListeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor(config: WebSocketConfig = {}) {
    this.maxReconnectAttempts = config.reconnectAttempts || 5;
    this.reconnectInterval = config.reconnectInterval || 5000;
    this.heartbeatInterval = config.heartbeatInterval || 30000;
    this.debug = config.debug || false;
  }

  connect(userId?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.CONNECTING)) {
        return resolve();
      }

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        return resolve();
      }

      this.isConnecting = true;
      this.isIntentionallyClosed = false;

      try {
        // Get WebSocket URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        this.log('Connecting to WebSocket:', wsUrl);
        this.ws = new WebSocket(wsUrl);

        // Connection opened
        this.ws.onopen = () => {
          this.log('WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          
          // Authenticate connection
          if (userId) {
            this.send({
              type: 'authenticate',
              userId,
              timestamp: new Date().toISOString()
            });
          }

          // Start heartbeat
          this.startHeartbeat();
          
          // Update store
          store.dispatch(updateConnectedStatus(true));
          
          resolve();
        };

        // Message received
        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            this.log('Error parsing WebSocket message:', error);
          }
        };

        // Connection closed
        this.ws.onclose = (event) => {
          this.log('WebSocket closed:', event.code, event.reason);
          this.isConnecting = false;
          this.stopHeartbeat();
          
          // Update store
          store.dispatch(updateConnectedStatus(false));

          // Attempt reconnection if not intentionally closed
          if (!this.isIntentionallyClosed && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        // Connection error
        this.ws.onerror = (error) => {
          this.log('WebSocket error:', error);
          this.isConnecting = false;
          
          if (this.reconnectAttempts === 0) {
            reject(new Error('Failed to connect to WebSocket'));
          }
        };

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.isIntentionallyClosed = true;
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(1000, 'Client disconnect');
      }
      this.ws = null;
    }

    // Update store
    store.dispatch(updateConnectedStatus(false));
  }

  send(message: WebSocketMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.log('WebSocket not connected, cannot send message:', message);
      return false;
    }

    try {
      const messageWithTimestamp = {
        ...message,
        timestamp: message.timestamp || new Date().toISOString()
      };
      
      this.ws.send(JSON.stringify(messageWithTimestamp));
      this.log('Sent message:', messageWithTimestamp);
      return true;
    } catch (error) {
      this.log('Error sending message:', error);
      return false;
    }
  }

  // Subscribe to specific message types
  subscribe(messageType: string, handler: (data: any) => void): () => void {
    if (!this.eventListeners.has(messageType)) {
      this.eventListeners.set(messageType, new Set());
    }
    
    this.eventListeners.get(messageType)!.add(handler);
    
    // Return unsubscribe function
    return () => {
      const handlers = this.eventListeners.get(messageType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.eventListeners.delete(messageType);
        }
      }
    };
  }

  // Register global message handler
  onMessage(type: string, handler: (data: any) => void): void {
    this.messageHandlers.set(type, handler);
  }

  // Remove message handler
  offMessage(type: string): void {
    this.messageHandlers.delete(type);
  }

  private handleMessage(message: WebSocketMessage): void {
    this.log('Received message:', message);

    // Handle global message handlers
    const globalHandler = this.messageHandlers.get(message.type);
    if (globalHandler) {
      globalHandler(message.data);
    }

    // Handle event listeners
    const listeners = this.eventListeners.get(message.type);
    if (listeners) {
      listeners.forEach(handler => {
        try {
          handler(message.data);
        } catch (error) {
          this.log('Error in message handler:', error);
        }
      });
    }

    // Handle built-in message types
    switch (message.type) {
      case 'pong':
        this.log('Received pong');
        break;
      
      case 'authenticated':
        this.log('Authentication successful');
        break;
      
      case 'error':
        this.log('Server error:', message.data);
        break;
      
      case 'notification':
        this.handleNotification(message.data);
        break;
      
      case 'feed_update':
        this.handleFeedUpdate(message.data);
        break;
      
      case 'behavior_event':
        this.handleBehaviorEvent(message.data);
        break;

      default:
        this.log('Unhandled message type:', message.type);
    }
  }

  private handleNotification(data: any): void {
    // Dispatch notification to store
    // This would integrate with your notification system
    this.log('New notification:', data);
  }

  private handleFeedUpdate(data: any): void {
    // Handle real-time feed updates
    this.log('Feed update:', data);
  }

  private handleBehaviorEvent(data: any): void {
    // Handle behavior tracking events
    this.log('Behavior event:', data);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, this.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectInterval * this.reconnectAttempts;
    
    this.log(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      if (!this.isIntentionallyClosed) {
        this.log(`Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        this.connect().catch(error => {
          this.log('Reconnect failed:', error);
        });
      }
    }, delay);
  }

  private log(...args: any[]): void {
    if (this.debug || process.env.NODE_ENV === 'development') {
      console.log('[WebSocket]', ...args);
    }
  }

  // Getters
  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  get readyState(): number {
    return this.ws ? this.ws.readyState : WebSocket.CLOSED;
  }

  get connectionState(): string {
    if (!this.ws) return 'disconnected';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
        return 'closing';
      case WebSocket.CLOSED:
        return 'disconnected';
      default:
        return 'unknown';
    }
  }
}

// Create singleton instance
const webSocketService = new WebSocketService({
  reconnectAttempts: 5,
  reconnectInterval: 5000,
  heartbeatInterval: 30000,
  debug: process.env.NODE_ENV === 'development'
});

// Convenience functions
export const initializeWebSocket = async (userId?: string): Promise<void> => {
  return webSocketService.connect(userId);
};

export const sendMessage = (message: WebSocketMessage): boolean => {
  return webSocketService.send(message);
};

export const subscribeToMessages = (messageType: string, handler: (data: any) => void): (() => void) => {
  return webSocketService.subscribe(messageType, handler);
};

export const disconnectWebSocket = (): void => {
  webSocketService.disconnect();
};

// Behavior tracking helpers
export const trackBehaviorEvent = (event: {
  type: string;
  postId?: string;
  metadata?: any;
}): boolean => {
  return sendMessage({
    type: 'behavior_event',
    data: {
      ...event,
      timestamp: new Date().toISOString(),
      sessionId: sessionStorage.getItem('session_id') || 'unknown'
    }
  });
};

// Real-time feed updates
export const subscribeToFeedUpdates = (handler: (data: any) => void): (() => void) => {
  return subscribeToMessages('feed_update', handler);
};

// Notification subscription
export const subscribeToNotifications = (handler: (data: any) => void): (() => void) => {
  return subscribeToMessages('notification', handler);
};

export { webSocketService };
export default webSocketService;
