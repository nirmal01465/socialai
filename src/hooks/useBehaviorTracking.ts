import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import axios from 'axios';

interface BehaviorEvent {
  type: string;
  postId?: string;
  timestamp: number;
  dwellTime?: number;
  scrollPosition?: number;
  deviceInfo?: any;
  sessionData?: any;
  metadata?: any;
}

interface BehaviorSummary {
  totalEvents: number;
  sessionDuration: number;
  engagementPatterns: {
    engagementRate: number;
    skipRate: number;
    commentRate: number;
    shareRate: number;
    saveRate: number;
  };
  scrollBehavior: {
    scrollSpeed: 'slow' | 'medium' | 'fast';
    avgDwellTime: number;
    scrollDirection: 'up' | 'down' | 'mixed';
  };
  contentTypeEngagement: {
    video: number;
    image: number;
    text: number;
    longform: number;
    shorts: number;
  };
  topTags: string[];
  topCreators: string[];
  moodIndicators: string[];
  timePatterns: any;
  cognitiveLoad: number;
  attentionSpan: number;
}

interface SessionContext {
  startTime: number;
  duration: number;
  interactions: number;
  scrollVelocity: number;
  engagementRate: number;
  skipRate: number;
  dwellTime: number;
  currentMood: string;
  sessionMode: string;
}

export const useBehaviorTracking = () => {
  const { user } = useAppSelector(state => state.auth);
  const dispatch = useAppDispatch();
  
  const [behaviorQueue, setBehaviorQueue] = useState<BehaviorEvent[]>([]);
  const [currentSession, setCurrentSession] = useState<SessionContext | null>(null);
  const [lastSummary, setLastSummary] = useState<BehaviorSummary | null>(null);
  
  const sessionStartRef = useRef<number>(Date.now());
  const lastScrollRef = useRef<number>(0);
  const scrollVelocityRef = useRef<number[]>([]);
  const eventQueueRef = useRef<BehaviorEvent[]>([]);

  // Initialize session tracking
  useEffect(() => {
    if (user && !currentSession) {
      const newSession: SessionContext = {
        startTime: Date.now(),
        duration: 0,
        interactions: 0,
        scrollVelocity: 0,
        engagementRate: 0,
        skipRate: 0,
        dwellTime: 0,
        currentMood: 'neutral',
        sessionMode: 'default'
      };
      setCurrentSession(newSession);
      sessionStartRef.current = Date.now();
    }
  }, [user]);

  // Revolutionary Behavior Tracking
  const trackBehavior = useCallback((event: BehaviorEvent) => {
    if (!user || !currentSession) return;

    const enhancedEvent: BehaviorEvent = {
      ...event,
      timestamp: Date.now(),
      deviceInfo: {
        userAgent: navigator.userAgent,
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      },
      sessionData: {
        sessionId: sessionStartRef.current,
        sessionDuration: Date.now() - sessionStartRef.current,
        scrollPosition: window.scrollY
      }
    };

    // Add to local queue for real-time analysis
    setBehaviorQueue(prev => [...prev.slice(-100), enhancedEvent]); // Keep last 100 events
    eventQueueRef.current.push(enhancedEvent);

    // Update session context in real-time
    updateSessionContext(enhancedEvent);

    console.log('🧠 Behavior tracked:', enhancedEvent);
  }, [user, currentSession]);

  // Update session context with real-time metrics
  const updateSessionContext = (event: BehaviorEvent) => {
    if (!currentSession) return;

    setCurrentSession(prev => {
      if (!prev) return null;
      
      const newDuration = Date.now() - prev.startTime;
      const newInteractions = prev.interactions + 1;
      
      return {
        ...prev,
        duration: newDuration,
        interactions: newInteractions,
        engagementRate: calculateEngagementRate(eventQueueRef.current),
        skipRate: calculateSkipRate(eventQueueRef.current),
        dwellTime: calculateAvgDwellTime(eventQueueRef.current),
        currentMood: inferMoodFromBehavior(eventQueueRef.current)
      };
    });
  };

  // Advanced tracking methods
  const trackPostView = useCallback((postId: string, metadata?: any) => {
    const viewStartTime = Date.now();
    
    trackBehavior({
      type: 'post_view',
      postId,
      metadata: {
        ...metadata,
        viewStartTime,
        scrollPosition: window.scrollY,
        timeOfDay: new Date().getHours(),
        dayOfWeek: new Date().getDay()
      }
    });

    // Return a function to track when user leaves the post
    return () => {
      const dwellTime = Date.now() - viewStartTime;
      trackBehavior({
        type: 'post_view_end',
        postId,
        dwellTime,
        metadata: {
          ...metadata,
          dwellTime,
          engaged: dwellTime > 3000 // 3+ seconds considered engaged
        }
      });
    };
  }, [trackBehavior]);

  const trackPostEngagement = useCallback((postId: string, type: string, metadata?: any) => {
    trackBehavior({
      type: 'post_engagement',
      postId,
      metadata: {
        postId,
        engagementType: type,
        intensity: getEngagementIntensity(type),
        ...metadata
      }
    });
  }, [trackBehavior]);

  const trackScrollBehavior = useCallback((scrollY: number, scrollDirection: 'up' | 'down') => {
    const now = Date.now();
    const timeDiff = now - lastScrollRef.current;
    const scrollDiff = Math.abs(scrollY - (scrollVelocityRef.current[scrollVelocityRef.current.length - 1] || 0));
    
    if (timeDiff > 0) {
      const velocity = scrollDiff / timeDiff;
      scrollVelocityRef.current.push(velocity);
      
      // Keep only last 20 measurements
      if (scrollVelocityRef.current.length > 20) {
        scrollVelocityRef.current.shift();
      }
      
      trackBehavior({
        type: 'scroll_behavior',
        metadata: {
          scrollY,
          scrollDirection,
          velocity,
          avgVelocity: scrollVelocityRef.current.reduce((a, b) => a + b, 0) / scrollVelocityRef.current.length
        }
      });
    }
    
    lastScrollRef.current = now;
  }, [trackBehavior]);

  const trackUIInteraction = useCallback((element: string, action: string, metadata?: any) => {
    trackBehavior({
      type: 'ui_interaction',
      metadata: {
        element,
        action,
        context: getCurrentContext(),
        userIntent: inferUserIntent(action, element),
        ...metadata
      }
    });
  }, [trackBehavior]);

  const trackSessionMode = useCallback((mode: string, trigger: string) => {
    trackBehavior({
      type: 'session_mode_change',
      metadata: {
        newMode: mode,
        previousMode: currentSession?.sessionMode,
        trigger,
        sessionDuration: currentSession?.duration || 0
      }
    });
    
    setCurrentSession(prev => prev ? { ...prev, sessionMode: mode } : null);
  }, [trackBehavior, currentSession]);

  const trackMoodIndicator = useCallback((indicator: string, confidence: number) => {
    trackBehavior({
      type: 'mood_indicator',
      metadata: {
        indicator,
        confidence,
        timeOfDay: new Date().getHours(),
        sessionDuration: currentSession?.duration || 0
      }
    });
  }, [trackBehavior, currentSession]);

  // Generate AI-ready behavior summary
  const generateBehaviorSummary = useCallback(async (): Promise<BehaviorSummary> => {
    const events = eventQueueRef.current;
    
    const summary: BehaviorSummary = {
      totalEvents: events.length,
      sessionDuration: currentSession?.duration || 0,
      engagementPatterns: {
        engagementRate: calculateEngagementRate(events),
        skipRate: calculateSkipRate(events),
        commentRate: calculateCommentRate(events),
        shareRate: calculateShareRate(events),
        saveRate: calculateSaveRate(events)
      },
      scrollBehavior: {
        scrollSpeed: calculateScrollSpeed(scrollVelocityRef.current),
        avgDwellTime: calculateAvgDwellTime(events),
        scrollDirection: calculateScrollDirection(events)
      },
      contentTypeEngagement: calculateContentTypeEngagement(events),
      topTags: extractTopTags(events),
      topCreators: extractTopCreators(events),
      moodIndicators: extractMoodIndicators(events),
      timePatterns: analyzeTimePatterns(events),
      cognitiveLoad: calculateCognitiveLoad(events),
      attentionSpan: calculateAttentionSpan(events)
    };
    
    setLastSummary(summary);
    return summary;
  }, [currentSession]);

  // Send behavior summary to AI decision engine
  const sendToAIEngine = useCallback(async () => {
    if (!user || eventQueueRef.current.length < 10) return; // Need minimum events
    
    try {
      const summary = await generateBehaviorSummary();
      
      await axios.post('/api/ai/behavior-summary', {
        userId: user.id,
        summary,
        sessionContext: currentSession,
        timestamp: new Date().toISOString()
      });
      
      // Clear processed events but keep recent ones for context
      eventQueueRef.current = eventQueueRef.current.slice(-20);
    } catch (error) {
      console.error('Failed to send behavior summary to AI:', error);
    }
  }, [user, currentSession, generateBehaviorSummary]);

  // Periodic AI updates (every 2 minutes)
  useEffect(() => {
    const interval = setInterval(sendToAIEngine, 120000); // 2 minutes
    return () => clearInterval(interval);
  }, [sendToAIEngine]);

  // Utility functions for behavior analysis
  const calculateEngagementRate = (events: BehaviorEvent[]): number => {
    const engagementEvents = events.filter(e => 
      e.type === 'post_engagement' || 
      (e.type === 'post_view_end' && (e.dwellTime || 0) > 3000)
    );
    const viewEvents = events.filter(e => e.type === 'post_view');
    return viewEvents.length > 0 ? engagementEvents.length / viewEvents.length : 0;
  };

  const calculateSkipRate = (events: BehaviorEvent[]): number => {
    const quickSkips = events.filter(e => 
      e.type === 'post_view_end' && (e.dwellTime || 0) < 1000
    );
    const viewEvents = events.filter(e => e.type === 'post_view');
    return viewEvents.length > 0 ? quickSkips.length / viewEvents.length : 0;
  };

  const calculateCommentRate = (events: BehaviorEvent[]): number => {
    const comments = events.filter(e => 
      e.type === 'post_engagement' && e.metadata?.engagementType === 'comment'
    );
    const views = events.filter(e => e.type === 'post_view');
    return views.length > 0 ? comments.length / views.length : 0;
  };

  const calculateShareRate = (events: BehaviorEvent[]): number => {
    const shares = events.filter(e => 
      e.type === 'post_engagement' && e.metadata?.engagementType === 'share'
    );
    const views = events.filter(e => e.type === 'post_view');
    return views.length > 0 ? shares.length / views.length : 0;
  };

  const calculateSaveRate = (events: BehaviorEvent[]): number => {
    const saves = events.filter(e => 
      e.type === 'post_engagement' && e.metadata?.engagementType === 'save'
    );
    const views = events.filter(e => e.type === 'post_view');
    return views.length > 0 ? saves.length / views.length : 0;
  };

  const calculateScrollSpeed = (velocities: number[]): 'slow' | 'medium' | 'fast' => {
    if (velocities.length === 0) return 'medium';
    const avgVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;
    if (avgVelocity < 0.5) return 'slow';
    if (avgVelocity > 2) return 'fast';
    return 'medium';
  };

  const calculateAvgDwellTime = (events: BehaviorEvent[]): number => {
    const dwellEvents = events.filter(e => e.dwellTime);
    if (dwellEvents.length === 0) return 5000; // Default 5 seconds
    return dwellEvents.reduce((sum, e) => sum + (e.dwellTime || 0), 0) / dwellEvents.length;
  };

  const calculateScrollDirection = (events: BehaviorEvent[]): 'up' | 'down' | 'mixed' => {
    const scrollEvents = events.filter(e => e.type === 'scroll_behavior');
    if (scrollEvents.length === 0) return 'mixed';
    
    const directions = scrollEvents.map(e => e.metadata?.scrollDirection);
    const downCount = directions.filter(d => d === 'down').length;
    const upCount = directions.filter(d => d === 'up').length;
    
    if (downCount > upCount * 1.5) return 'down';
    if (upCount > downCount * 1.5) return 'up';
    return 'mixed';
  };

  const calculateContentTypeEngagement = (events: BehaviorEvent[]): any => {
    const engagements = events.filter(e => e.type === 'post_engagement');
    const types = { video: 0, image: 0, text: 0, longform: 0, shorts: 0 };
    
    engagements.forEach(e => {
      const contentType = e.metadata?.contentType;
      if (contentType && types.hasOwnProperty(contentType)) {
        types[contentType as keyof typeof types]++;
      }
    });
    
    return types;
  };

  const extractTopTags = (events: BehaviorEvent[]): string[] => {
    const tagCounts: { [tag: string]: number } = {};
    
    events.forEach(e => {
      if (e.metadata?.tags) {
        e.metadata.tags.forEach((tag: string) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });
    
    return Object.entries(tagCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([tag]) => tag);
  };

  const extractTopCreators = (events: BehaviorEvent[]): string[] => {
    const creatorCounts: { [creator: string]: number } = {};
    
    events.forEach(e => {
      if (e.metadata?.creator) {
        const creator = e.metadata.creator;
        creatorCounts[creator] = (creatorCounts[creator] || 0) + 1;
      }
    });
    
    return Object.entries(creatorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([creator]) => creator);
  };

  const extractMoodIndicators = (events: BehaviorEvent[]): string[] => {
    const moodEvents = events.filter(e => e.type === 'mood_indicator');
    return moodEvents.map(e => e.metadata?.indicator).filter(Boolean);
  };

  const analyzeTimePatterns = (events: BehaviorEvent[]): any => {
    const hourlyActivity: { [hour: number]: number } = {};
    
    events.forEach(e => {
      const hour = new Date(e.timestamp).getHours();
      hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
    });
    
    return {
      hourlyActivity,
      peakHours: Object.entries(hourlyActivity)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([hour]) => parseInt(hour))
    };
  };

  const calculateCognitiveLoad = (events: BehaviorEvent[]): number => {
    const multitaskingEvents = events.filter(e => e.metadata?.multitasking);
    const totalEvents = events.length;
    return totalEvents > 0 ? multitaskingEvents.length / totalEvents : 0;
  };

  const calculateAttentionSpan = (events: BehaviorEvent[]): number => {
    const dwellTimes = events
      .filter(e => e.dwellTime)
      .map(e => e.dwellTime || 0);
    
    if (dwellTimes.length === 0) return 15; // Default 15 seconds
    
    const avgDwell = dwellTimes.reduce((a, b) => a + b, 0) / dwellTimes.length;
    return Math.min(60, Math.max(5, avgDwell / 1000)); // 5-60 seconds
  };

  const getEngagementIntensity = (type: string): number => {
    const intensities: { [key: string]: number } = {
      'view': 1,
      'like': 2,
      'comment': 4,
      'share': 5,
      'save': 3,
      'follow': 6
    };
    return intensities[type] || 1;
  };

  const getCurrentContext = (): string => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour <= 9) return 'morning';
    if (hour >= 10 && hour <= 17) return 'work';
    if (hour >= 18 && hour <= 22) return 'evening';
    return 'late_night';
  };

  const inferUserIntent = (action: string, element: string): string => {
    if (action === 'click' && element.includes('search')) return 'discovery';
    if (action === 'scroll' && element === 'feed') return 'browsing';
    if (action === 'click' && element.includes('filter')) return 'curation';
    return 'engagement';
  };

  const inferMoodFromBehavior = (events: BehaviorEvent[]): string => {
    const recent = events.slice(-10); // Last 10 events
    const engagementRate = calculateEngagementRate(recent);
    const avgVelocity = scrollVelocityRef.current.slice(-5).reduce((a, b) => a + b, 0) / 5;
    
    if (engagementRate > 0.3 && avgVelocity < 1) return 'engaged';
    if (engagementRate < 0.1 && avgVelocity > 2) return 'restless';
    if (engagementRate > 0.2 && avgVelocity < 0.5) return 'focused';
    return 'neutral';
  };

  return {
    trackBehavior,
    trackPostView,
    trackPostEngagement,
    trackScrollBehavior,
    trackUIInteraction,
    trackSessionMode,
    trackMoodIndicator,
    generateBehaviorSummary,
    sendToAIEngine,
    currentSession,
    lastSummary,
    behaviorQueue
  };
};