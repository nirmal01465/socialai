import { useState, useEffect, useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import axios from 'axios';

interface UIDecision {
  version: string;
  layout: {
    sections: Array<{
      id: string;
      priority: number;
      visible: boolean;
      style?: string;
    }>;
    feedColumns: number;
    cardStyle: 'minimal' | 'detailed' | 'immersive';
    showSidebar: boolean;
    adaptiveFeatures: {
      autoSummary: boolean;
      contextualSuggestions: boolean;
      smartNotifications: boolean;
      realTimeAdaptation: boolean;
    };
  };
  featureFlags: {
    [key: string]: boolean;
  };
  feedRules: {
    blocklist: string[];
    boostTags: string[];
    preferredContentTypes: string[];
    diversityWeight: number;
    moodOptimization: boolean;
  };
  reasoning?: string;
  confidence?: number;
  lastUpdated?: number;
}

interface SessionMode {
  id: 'quick_hits' | 'deep_dive' | 'discovery' | 'focus' | 'social' | 'learning';
  label: string;
  description: string;
  icon: string;
  adaptations: string[];
  duration?: number;
}

export const useAdaptiveUI = () => {
  const { user } = useAppSelector(state => state.auth);
  const { behaviorSummary, currentSession } = useAppSelector(state => state.behavior || {});
  const dispatch = useAppDispatch();
  
  const [uiDecisions, setUIDecisions] = useState<UIDecision | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [currentSessionMode, setCurrentSessionMode] = useState<SessionMode['id']>('discovery');
  const [adaptationHistory, setAdaptationHistory] = useState<UIDecision[]>([]);
  const [lastOptimization, setLastOptimization] = useState<number>(0);

  // Revolutionary Session Modes
  const sessionModes: SessionMode[] = [
    {
      id: 'quick_hits',
      label: 'Quick Hits',
      description: 'Bite-sized content for busy moments',
      icon: '⚡',
      adaptations: [
        'Short-form content prioritized',
        'Minimal card style',
        'Reduced text density',
        'Fast-scan optimized layout'
      ],
      duration: 900000 // 15 minutes
    },
    {
      id: 'deep_dive',
      label: 'Deep Dive',
      description: 'Immersive content exploration',
      icon: '🌊',
      adaptations: [
        'Long-form content prioritized',
        'Detailed card style',
        'Related content clusters',
        'Distraction-free layout'
      ]
    },
    {
      id: 'discovery',
      label: 'Discovery',
      description: 'Explore new interests and creators',
      icon: '🔍',
      adaptations: [
        '40% content outside comfort zone',
        'New creator introductions',
        'Trending topic integration',
        'Serendipity optimization'
      ]
    },
    {
      id: 'focus',
      label: 'Focus',
      description: 'Single topic deep exploration',
      icon: '🎯',
      adaptations: [
        'Topic-specific content only',
        'Expert sources prioritized',
        'Learning progression',
        'Minimal distractions'
      ]
    },
    {
      id: 'social',
      label: 'Social',
      description: 'Connect and engage with friends',
      icon: '👥',
      adaptations: [
        'Friends and family prioritized',
        'Social interaction opportunities',
        'Conversation starters',
        'Community engagement'
      ]
    },
    {
      id: 'learning',
      label: 'Learning',
      description: 'Educational and skill-building content',
      icon: '📚',
      adaptations: [
        'Educational content prioritized',
        'Progressive difficulty',
        'Knowledge retention optimized',
        'Learning path construction'
      ]
    }
  ];

  // AI-Powered UI Optimization
  const optimizeUI = useCallback(async (forceUpdate: boolean = false) => {
    if (!user) return;

    const now = Date.now();
    const timeSinceLastOptimization = now - lastOptimization;
    
    // Avoid too frequent optimizations unless forced
    if (!forceUpdate && timeSinceLastOptimization < 300000) return; // 5 minutes minimum

    setIsOptimizing(true);

    try {
      const response = await axios.post('/api/ai/ui-decisions', {
        userId: user.id,
        behaviorSummary: behaviorSummary || {},
        sessionContext: {
          ...currentSession,
          currentMode: currentSessionMode,
          screenWidth: window.innerWidth,
          screenHeight: window.innerHeight,
          deviceType: window.innerWidth < 768 ? 'mobile' : 'desktop',
          timeOfDay: new Date().getHours(),
          dayOfWeek: new Date().getDay()
        },
        currentDecisions: uiDecisions,
        timestamp: new Date().toISOString()
      });

      const newDecisions: UIDecision = {
        ...response.data,
        lastUpdated: now,
        confidence: response.data.confidence || 0.8
      };

      setUIDecisions(newDecisions);
      setAdaptationHistory(prev => [...prev.slice(-9), newDecisions]); // Keep last 10
      setLastOptimization(now);

      // Apply UI changes immediately
      applyUIDecisions(newDecisions);

      console.log('🎨 UI optimized by AI:', newDecisions);
    } catch (error) {
      console.error('AI UI optimization failed:', error);
      
      // Fallback to intelligent heuristic-based decisions
      const fallbackDecisions = generateFallbackDecisions();
      setUIDecisions(fallbackDecisions);
      applyUIDecisions(fallbackDecisions);
    } finally {
      setIsOptimizing(false);
    }
  }, [user, behaviorSummary, currentSession, currentSessionMode, uiDecisions, lastOptimization]);

  // Apply UI decisions to the interface
  const applyUIDecisions = useCallback((decisions: UIDecision) => {
    if (!decisions) return;

    // Apply CSS custom properties for dynamic styling
    const root = document.documentElement;
    
    // Layout adaptations
    root.style.setProperty('--feed-columns', decisions.layout.feedColumns.toString());
    root.style.setProperty('--card-style', decisions.layout.cardStyle);
    root.style.setProperty('--sidebar-display', decisions.layout.showSidebar ? 'block' : 'none');
    
    // Content density
    const densityClass = getDensityClass(decisions);
    document.body.className = document.body.className.replace(/density-\w+/g, '') + ` ${densityClass}`;
    
    // Feature flags
    toggleFeatures(decisions.featureFlags);
    
    // Dispatch to Redux store for component access
    // dispatch(updateUIDecisions(decisions));
  }, []);

  // Generate intelligent fallback decisions
  const generateFallbackDecisions = useCallback((): UIDecision => {
    const screenWidth = window.innerWidth;
    const hour = new Date().getHours();
    const isWorkHours = hour >= 9 && hour <= 17;
    const isMobile = screenWidth < 768;
    
    return {
      version: "1.0",
      layout: {
        sections: [
          { id: "unified_feed", priority: 0, visible: true, style: "adaptive" },
          { id: "trending", priority: 1, visible: !isWorkHours, style: "compact" },
          { id: "discover", priority: 2, visible: !isMobile, style: "minimal" }
        ],
        feedColumns: isMobile ? 1 : screenWidth > 1200 ? 2 : 1,
        cardStyle: isMobile ? 'minimal' : isWorkHours ? 'detailed' : 'immersive',
        showSidebar: !isMobile && !isWorkHours,
        adaptiveFeatures: {
          autoSummary: !isMobile,
          contextualSuggestions: true,
          smartNotifications: true,
          realTimeAdaptation: true
        }
      },
      featureFlags: {
        commandBar: true,
        whyThisPost: true,
        sessionModes: true,
        creatorAffinity: !isWorkHours,
        moodDetection: true,
        focusMode: isWorkHours
      },
      feedRules: {
        blocklist: isWorkHours ? ["entertainment", "memes"] : ["spam"],
        boostTags: isWorkHours ? ["productivity", "professional"] : ["trending", "entertainment"],
        preferredContentTypes: isMobile ? ["video", "image"] : ["video", "image", "article"],
        diversityWeight: 0.7,
        moodOptimization: true
      },
      reasoning: "Fallback decision based on device type, time, and basic heuristics",
      confidence: 0.6,
      lastUpdated: Date.now()
    };
  }, []);

  // Session Mode Management
  const switchSessionMode = useCallback(async (mode: SessionMode['id'], duration?: number) => {
    const selectedMode = sessionModes.find(m => m.id === mode);
    if (!selectedMode) return;

    setCurrentSessionMode(mode);
    
    try {
      // Notify AI of mode change
      await axios.post('/api/ai/session-mode', {
        userId: user?.id,
        mode,
        duration: duration || selectedMode.duration,
        trigger: 'user_selection',
        timestamp: new Date().toISOString()
      });

      // Force UI re-optimization for new mode
      await optimizeUI(true);

      // Auto-revert after duration if specified
      if (duration && duration > 0) {
        setTimeout(() => {
          switchSessionMode('discovery');
        }, duration);
      }

      console.log(`🎯 Switched to ${selectedMode.label} mode`);
    } catch (error) {
      console.error('Failed to switch session mode:', error);
    }
  }, [sessionModes, user, optimizeUI]);

  // Real-time adaptation triggers
  const triggerAdaptation = useCallback((reason: string, intensity: number = 1) => {
    if (intensity > 0.7) {
      // High intensity changes trigger immediate optimization
      optimizeUI(true);
    } else if (intensity > 0.4) {
      // Medium intensity changes trigger delayed optimization
      setTimeout(() => optimizeUI(), 30000); // 30 seconds
    }
    // Low intensity changes are handled by regular optimization cycle
  }, [optimizeUI]);

  // Monitor behavior changes for real-time adaptation
  useEffect(() => {
    if (!behaviorSummary || !currentSession) return;

    const recentChanges = analyzeRecentChanges();
    if (recentChanges.significance > 0.5) {
      triggerAdaptation('behavior_change', recentChanges.significance);
    }
  }, [behaviorSummary, currentSession, triggerAdaptation]);

  // Regular optimization cycle
  useEffect(() => {
    if (!user) return;

    // Initial optimization
    optimizeUI();

    // Regular optimization every 10 minutes
    const interval = setInterval(() => optimizeUI(), 600000);
    
    // Re-optimize on window resize
    const handleResize = () => {
      setTimeout(() => optimizeUI(true), 500); // Debounce
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
    };
  }, [user, optimizeUI]);

  // Utility functions
  const getDensityClass = (decisions: UIDecision): string => {
    const cardStyle = decisions.layout.cardStyle;
    const columns = decisions.layout.feedColumns;
    
    if (cardStyle === 'minimal' || columns > 1) return 'density-compact';
    if (cardStyle === 'immersive') return 'density-spacious';
    return 'density-standard';
  };

  const toggleFeatures = (featureFlags: { [key: string]: boolean }) => {
    Object.entries(featureFlags).forEach(([feature, enabled]) => {
      document.body.classList.toggle(`feature-${feature}`, enabled);
    });
  };

  const analyzeRecentChanges = (): { significance: number; reasons: string[] } => {
    if (!behaviorSummary || adaptationHistory.length < 2) {
      return { significance: 0, reasons: [] };
    }

    const reasons: string[] = [];
    let significance = 0;

    // Check for significant behavior pattern changes
    const engagementRate = behaviorSummary.engagementPatterns?.engagementRate || 0;
    const skipRate = behaviorSummary.engagementPatterns?.skipRate || 0;
    
    if (skipRate > 0.7) {
      significance += 0.4;
      reasons.push('high_skip_rate');
    }
    
    if (engagementRate < 0.1) {
      significance += 0.3;
      reasons.push('low_engagement');
    }

    // Check for session duration changes
    const sessionDuration = currentSession?.duration || 0;
    if (sessionDuration > 1800000) { // 30 minutes
      significance += 0.2;
      reasons.push('long_session');
    }

    return { significance: Math.min(1, significance), reasons };
  };

  // Mood-based adaptations
  const getCurrentMood = (): string => {
    if (!currentSession) return 'neutral';
    
    const { engagementRate, skipRate } = currentSession;
    
    if (engagementRate > 0.3 && skipRate < 0.3) return 'engaged';
    if (skipRate > 0.7) return 'restless';
    if (engagementRate < 0.1) return 'browsing';
    
    const hour = new Date().getHours();
    if (hour >= 6 && hour <= 9) return 'morning_energy';
    if (hour >= 18 && hour <= 22) return 'evening_relaxed';
    
    return 'neutral';
  };

  // Performance optimization
  const isUIResponsive = (): boolean => {
    return !isOptimizing && uiDecisions !== null;
  };

  return {
    uiDecisions,
    isOptimizing,
    currentSessionMode,
    sessionModes,
    adaptationHistory,
    optimizeUI,
    switchSessionMode,
    triggerAdaptation,
    getCurrentMood,
    isUIResponsive,
    applyUIDecisions
  };
};