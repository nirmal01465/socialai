interface BehaviorEvent {
  type: 'view' | 'like' | 'skip' | 'comment' | 'share' | 'save' | 'click' | 'scroll' | 'ui_interaction';
  postId?: string;
  timestamp: number;
  dwellTime?: number;
  scrollDepth?: number;
  metadata?: {
    platform?: string;
    contentType?: string;
    scrollSpeed?: 'slow' | 'medium' | 'fast';
    source?: string;
    sessionId?: string;
    [key: string]: any;
  };
}

interface SessionData {
  sessionId: string;
  startTime: number;
  lastActivity: number;
  events: BehaviorEvent[];
  deviceType: 'mobile' | 'tablet' | 'desktop';
  userAgent: string;
  screenSize: { width: number; height: number };
  connectionType?: string;
}

class BehaviorTracker {
  private session: SessionData;
  private eventQueue: BehaviorEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private isTracking = false;
  private maxQueueSize = 50;
  private flushIntervalMs = 10000; // 10 seconds
  private scrollStartTime = 0;
  private lastScrollY = 0;
  private intersectionObserver: IntersectionObserver | null = null;
  private visiblePosts: Set<string> = new Set();

  constructor() {
    this.session = this.createSession();
    this.setupEventListeners();
  }

  private createSession(): SessionData {
    const sessionId = this.generateSessionId();
    sessionStorage.setItem('session_id', sessionId);
    
    return {
      sessionId,
      startTime: Date.now(),
      lastActivity: Date.now(),
      events: [],
      deviceType: this.detectDeviceType(),
      userAgent: navigator.userAgent,
      screenSize: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      connectionType: this.getConnectionType()
    };
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private detectDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  private getConnectionType(): string {
    // @ts-ignore - navigator.connection is experimental
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return connection?.effectiveType || 'unknown';
  }

  private setupEventListeners(): void {
    // Page visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.trackEvent({
          type: 'ui_interaction',
          timestamp: Date.now(),
          metadata: { action: 'page_hidden' }
        });
        this.flush();
      } else {
        this.trackEvent({
          type: 'ui_interaction',
          timestamp: Date.now(),
          metadata: { action: 'page_visible' }
        });
      }
    });

    // Beforeunload - flush remaining events
    window.addEventListener('beforeunload', () => {
      this.flush();
    });

    // Scroll tracking
    let scrollTimeout: NodeJS.Timeout;
    window.addEventListener('scroll', () => {
      const currentScrollY = window.scrollY;
      
      if (this.scrollStartTime === 0) {
        this.scrollStartTime = Date.now();
      }

      // Clear existing timeout
      clearTimeout(scrollTimeout);
      
      // Set new timeout for scroll end detection
      scrollTimeout = setTimeout(() => {
        const scrollDuration = Date.now() - this.scrollStartTime;
        const scrollDistance = Math.abs(currentScrollY - this.lastScrollY);
        const scrollSpeed = this.calculateScrollSpeed(scrollDistance, scrollDuration);
        
        this.trackEvent({
          type: 'scroll',
          timestamp: Date.now(),
          metadata: {
            scrollSpeed,
            scrollDistance,
            scrollDuration,
            scrollPosition: currentScrollY,
            action: 'scroll_end'
          }
        });
        
        this.scrollStartTime = 0;
        this.lastScrollY = currentScrollY;
      }, 150);
    }, { passive: true });

    // Setup intersection observer for post visibility
    this.setupIntersectionObserver();
  }

  private setupIntersectionObserver(): void {
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const postId = entry.target.getAttribute('data-post-id');
          if (!postId) return;

          if (entry.isIntersecting) {
            // Post came into view
            if (!this.visiblePosts.has(postId)) {
              this.visiblePosts.add(postId);
              this.trackPostView(postId, {
                source: 'auto_scroll',
                intersectionRatio: entry.intersectionRatio
              });
            }
          } else {
            // Post left view
            if (this.visiblePosts.has(postId)) {
              this.visiblePosts.delete(postId);
              this.trackEvent({
                type: 'view',
                postId,
                timestamp: Date.now(),
                metadata: {
                  action: 'view_end',
                  intersectionRatio: entry.intersectionRatio
                }
              });
            }
          }
        });
      },
      {
        threshold: [0.1, 0.5, 0.9], // Track multiple visibility levels
        rootMargin: '0px 0px -50px 0px' // Require post to be more visible
      }
    );
  }

  private calculateScrollSpeed(distance: number, duration: number): 'slow' | 'medium' | 'fast' {
    if (duration === 0) return 'medium';
    
    const pixelsPerSecond = distance / (duration / 1000);
    
    if (pixelsPerSecond < 500) return 'slow';
    if (pixelsPerSecond < 1500) return 'medium';
    return 'fast';
  }

  start(): void {
    if (this.isTracking) return;
    
    this.isTracking = true;
    this.startFlushInterval();
    
    // Track session start
    this.trackEvent({
      type: 'ui_interaction',
      timestamp: Date.now(),
      metadata: {
        action: 'session_start',
        deviceType: this.session.deviceType,
        screenSize: this.session.screenSize,
        connectionType: this.session.connectionType
      }
    });
  }

  stop(): void {
    if (!this.isTracking) return;
    
    this.isTracking = false;
    this.stopFlushInterval();
    
    // Track session end
    this.trackEvent({
      type: 'ui_interaction',
      timestamp: Date.now(),
      metadata: {
        action: 'session_end',
        sessionDuration: Date.now() - this.session.startTime
      }
    });
    
    // Final flush
    this.flush();
  }

  trackEvent(event: Omit<BehaviorEvent, 'metadata'> & { metadata?: any }): void {
    if (!this.isTracking) return;

    const enrichedEvent: BehaviorEvent = {
      ...event,
      metadata: {
        ...event.metadata,
        sessionId: this.session.sessionId,
        deviceType: this.session.deviceType,
        timestamp: event.timestamp,
        userAgent: this.session.userAgent
      }
    };

    this.eventQueue.push(enrichedEvent);
    this.session.events.push(enrichedEvent);
    this.session.lastActivity = Date.now();

    // Auto-flush if queue is full
    if (this.eventQueue.length >= this.maxQueueSize) {
      this.flush();
    }
  }

  trackPostView(postId: string, metadata: any = {}): void {
    this.trackEvent({
      type: 'view',
      postId,
      timestamp: Date.now(),
      metadata: {
        ...metadata,
        viewStartTime: Date.now()
      }
    });
  }

  trackPostEngagement(postId: string, engagementType: string, metadata: any = {}): void {
    this.trackEvent({
      type: engagementType as any,
      postId,
      timestamp: Date.now(),
      metadata: {
        ...metadata,
        engagementType
      }
    });
  }

  trackUIInteraction(action: string, metadata: any = {}): void {
    this.trackEvent({
      type: 'ui_interaction',
      timestamp: Date.now(),
      metadata: {
        ...metadata,
        action
      }
    });
  }

  observePost(element: HTMLElement, postId: string): void {
    if (this.intersectionObserver && postId) {
      element.setAttribute('data-post-id', postId);
      this.intersectionObserver.observe(element);
    }
  }

  unobservePost(element: HTMLElement): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.unobserve(element);
    }
  }

  private startFlushInterval(): void {
    this.stopFlushInterval();
    this.flushInterval = setInterval(() => {
      this.flush();
    }, this.flushIntervalMs);
  }

  private stopFlushInterval(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  private async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      // Send to WebSocket if available
      const { trackBehaviorEvent } = await import('./websocket');
      
      // Send in batches
      const batchSize = 10;
      for (let i = 0; i < events.length; i += batchSize) {
        const batch = events.slice(i, i + batchSize);
        trackBehaviorEvent({
          type: 'behavior_batch',
          metadata: {
            events: batch,
            sessionId: this.session.sessionId
          }
        });
      }

      // Also send to API as backup
      const { api } = await import('./api');
      await api.feed.recordBehavior(events).catch(error => {
        console.warn('Failed to send behavior events to API:', error);
      });

    } catch (error) {
      console.error('Failed to flush behavior events:', error);
      // Re-add events to queue for retry
      this.eventQueue.unshift(...events);
    }
  }

  // Analytics helpers
  getSessionSummary(): {
    sessionId: string;
    duration: number;
    eventCount: number;
    topEventTypes: { [type: string]: number };
    scrollBehavior: {
      totalScrollEvents: number;
      avgScrollSpeed: string;
    };
    engagement: {
      viewedPosts: number;
      likedPosts: number;
      sharedPosts: number;
    };
  } {
    const eventCounts: { [type: string]: number } = {};
    let scrollEvents = 0;
    let totalScrollSpeed = 0;
    let viewedPosts = 0;
    let likedPosts = 0;
    let sharedPosts = 0;

    this.session.events.forEach(event => {
      eventCounts[event.type] = (eventCounts[event.type] || 0) + 1;
      
      if (event.type === 'scroll') {
        scrollEvents++;
        const speed = event.metadata?.scrollSpeed;
        if (speed === 'slow') totalScrollSpeed += 1;
        else if (speed === 'medium') totalScrollSpeed += 2;
        else if (speed === 'fast') totalScrollSpeed += 3;
      }
      
      if (event.type === 'view' && event.postId) viewedPosts++;
      if (event.type === 'like' && event.postId) likedPosts++;
      if (event.type === 'share' && event.postId) sharedPosts++;
    });

    const avgScrollSpeedValue = scrollEvents > 0 ? totalScrollSpeed / scrollEvents : 2;
    const avgScrollSpeed = avgScrollSpeedValue <= 1.5 ? 'slow' : 
                          avgScrollSpeedValue <= 2.5 ? 'medium' : 'fast';

    return {
      sessionId: this.session.sessionId,
      duration: Date.now() - this.session.startTime,
      eventCount: this.session.events.length,
      topEventTypes: eventCounts,
      scrollBehavior: {
        totalScrollEvents: scrollEvents,
        avgScrollSpeed
      },
      engagement: {
        viewedPosts,
        likedPosts,
        sharedPosts
      }
    };
  }

  // Export session data for debugging
  exportSessionData(): SessionData {
    return { ...this.session };
  }

  // Clear session data
  clearSession(): void {
    this.session = this.createSession();
    this.eventQueue = [];
    this.visiblePosts.clear();
  }
}

// Create singleton instance
const behaviorTracker = new BehaviorTracker();

// Auto-start tracking
if (typeof window !== 'undefined') {
  // Start tracking when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      behaviorTracker.start();
    });
  } else {
    behaviorTracker.start();
  }
}

export { behaviorTracker, BehaviorEvent, SessionData };
export default behaviorTracker;
