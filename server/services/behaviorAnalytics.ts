import BehaviorEvent from '../models/BehaviorEvent.js';
import User from '../models/User.js';
import { getRedisClient } from '../database/redis.js';

interface BehaviorSummary {
  totalEvents: number;
  topTags: string[];
  topCreators: string[];
  preferredContentTypes: string[];
  avgSessionDuration: number;
  peakActivityHours: number[];
  engagementPatterns: {
    skipRate: number;
    likeRate: number;
    shareRate: number;
    commentRate: number;
  };
  moodIndicators: string[];
  scrollBehavior: {
    avgDwellTime: number;
    scrollSpeed: 'slow' | 'medium' | 'fast';
    sessionTypes: string[];
  };
}

interface EventPattern {
  type: string;
  frequency: number;
  avgDwellTime?: number;
  timeDistribution: { [hour: number]: number };
}

class BehaviorAnalyticsService {
  
  // Generate comprehensive behavior summary for a user
  async generateSummary(userId: string, timeframe?: string): Promise<BehaviorSummary> {
    try {
      const redis = getRedisClient();
      const cacheKey = `behavior_summary:${userId}:${timeframe || '30d'}`;
      
      // Check cache first
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Calculate time threshold
      const now = new Date();
      const timeThresholds: { [key: string]: number } = {
        '1d': 1 * 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
        '90d': 90 * 24 * 60 * 60 * 1000
      };
      
      const threshold = new Date(now.getTime() - (timeThresholds[timeframe || '30d'] || timeThresholds['30d']));

      // Fetch behavior events
      const events = await BehaviorEvent.find({
        userId,
        timestamp: { $gte: threshold }
      }).sort({ timestamp: -1 });

      if (events.length === 0) {
        return this.getDefaultSummary();
      }

      // Generate comprehensive analysis
      const summary = await this.analyzeBehaviorEvents(events);
      
      // Cache for 15 minutes
      await redis.setex(cacheKey, 900, JSON.stringify(summary));
      
      return summary;

    } catch (error) {
      console.error('Behavior summary generation error:', error);
      return this.getDefaultSummary();
    }
  }

  // Analyze behavior events and extract patterns
  private async analyzeBehaviorEvents(events: any[]): Promise<BehaviorSummary> {
    const totalEvents = events.length;
    
    // Group events by type
    const eventsByType = this.groupEventsByType(events);
    
    // Calculate engagement patterns
    const engagementPatterns = this.calculateEngagementPatterns(eventsByType);
    
    // Extract content preferences
    const { topTags, topCreators, preferredContentTypes } = await this.extractContentPreferences(events);
    
    // Analyze temporal patterns
    const { avgSessionDuration, peakActivityHours } = this.analyzeTemporalPatterns(events);
    
    // Infer mood indicators
    const moodIndicators = this.inferMoodIndicators(events, engagementPatterns);
    
    // Analyze scroll behavior
    const scrollBehavior = this.analyzeScrollBehavior(events);

    return {
      totalEvents,
      topTags,
      topCreators,
      preferredContentTypes,
      avgSessionDuration,
      peakActivityHours,
      engagementPatterns,
      moodIndicators,
      scrollBehavior
    };
  }

  // Group events by type for analysis
  private groupEventsByType(events: any[]): { [key: string]: any[] } {
    return events.reduce((acc, event) => {
      if (!acc[event.eventType]) {
        acc[event.eventType] = [];
      }
      acc[event.eventType].push(event);
      return acc;
    }, {});
  }

  // Calculate engagement patterns
  private calculateEngagementPatterns(eventsByType: { [key: string]: any[] }): BehaviorSummary['engagementPatterns'] {
    const totalViews = eventsByType.view?.length || 0;
    const totalSkips = eventsByType.skip?.length || 0;
    const totalLikes = eventsByType.like?.length || 0;
    const totalShares = eventsByType.share?.length || 0;
    const totalComments = eventsByType.comment?.length || 0;

    const totalEngagements = totalViews + totalSkips;

    return {
      skipRate: totalEngagements > 0 ? totalSkips / totalEngagements : 0,
      likeRate: totalViews > 0 ? totalLikes / totalViews : 0,
      shareRate: totalViews > 0 ? totalShares / totalViews : 0,
      commentRate: totalViews > 0 ? totalComments / totalViews : 0
    };
  }

  // Extract content preferences from events
  private async extractContentPreferences(events: any[]): Promise<{
    topTags: string[];
    topCreators: string[];
    preferredContentTypes: string[];
  }> {
    // This would typically involve fetching post data and analyzing preferences
    const tagFrequency: { [key: string]: number } = {};
    const creatorFrequency: { [key: string]: number } = {};
    const typeFrequency: { [key: string]: number } = {};

    // For now, simulate based on event metadata
    events.forEach(event => {
      if (event.metadata?.tags) {
        event.metadata.tags.forEach((tag: string) => {
          tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
        });
      }
      
      if (event.metadata?.creator) {
        const creator = event.metadata.creator;
        creatorFrequency[creator] = (creatorFrequency[creator] || 0) + 1;
      }
      
      if (event.metadata?.contentType) {
        const type = event.metadata.contentType;
        typeFrequency[type] = (typeFrequency[type] || 0) + 1;
      }
    });

    return {
      topTags: Object.entries(tagFrequency)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([tag]) => tag),
      topCreators: Object.entries(creatorFrequency)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([creator]) => creator),
      preferredContentTypes: Object.entries(typeFrequency)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([type]) => type)
    };
  }

  // Analyze temporal patterns
  private analyzeTemporalPatterns(events: any[]): {
    avgSessionDuration: number;
    peakActivityHours: number[];
  } {
    // Group events by session
    const sessions = this.groupEventsBySessions(events);
    
    // Calculate average session duration
    const sessionDurations = sessions.map(session => {
      if (session.length < 2) return 0;
      const start = new Date(session[0].timestamp).getTime();
      const end = new Date(session[session.length - 1].timestamp).getTime();
      return (end - start) / 1000; // in seconds
    });

    const avgSessionDuration = sessionDurations.length > 0 
      ? sessionDurations.reduce((sum, duration) => sum + duration, 0) / sessionDurations.length 
      : 0;

    // Calculate peak activity hours
    const hourCounts: { [hour: number]: number } = {};
    events.forEach(event => {
      const hour = new Date(event.timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const peakActivityHours = Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));

    return {
      avgSessionDuration,
      peakActivityHours
    };
  }

  // Group events by sessions (events within 30 minutes are considered same session)
  private groupEventsBySessions(events: any[]): any[][] {
    const sessions: any[][] = [];
    let currentSession: any[] = [];
    const sessionThreshold = 30 * 60 * 1000; // 30 minutes in milliseconds

    events.forEach((event, index) => {
      if (index === 0) {
        currentSession.push(event);
        return;
      }

      const currentTime = new Date(event.timestamp).getTime();
      const lastTime = new Date(events[index - 1].timestamp).getTime();

      if (currentTime - lastTime <= sessionThreshold) {
        currentSession.push(event);
      } else {
        if (currentSession.length > 0) {
          sessions.push([...currentSession]);
        }
        currentSession = [event];
      }
    });

    if (currentSession.length > 0) {
      sessions.push(currentSession);
    }

    return sessions;
  }

  // Infer mood indicators from behavior patterns
  private inferMoodIndicators(events: any[], engagementPatterns: BehaviorSummary['engagementPatterns']): string[] {
    const indicators: string[] = [];

    // High skip rate might indicate distracted or rushed mood
    if (engagementPatterns.skipRate > 0.7) {
      indicators.push('quick_hits');
    }

    // High engagement rate might indicate focused mood
    if (engagementPatterns.likeRate > 0.3) {
      indicators.push('engaged');
    }

    // Low overall activity might indicate passive consumption
    if (events.length < 50) {
      indicators.push('passive');
    }

    // High activity might indicate active exploration
    if (events.length > 200) {
      indicators.push('exploratory');
    }

    return indicators.length > 0 ? indicators : ['neutral'];
  }

  // Analyze scroll behavior patterns
  private analyzeScrollBehavior(events: any[]): BehaviorSummary['scrollBehavior'] {
    const viewEvents = events.filter(e => e.eventType === 'view' && e.dwellTime);
    
    if (viewEvents.length === 0) {
      return {
        avgDwellTime: 0,
        scrollSpeed: 'medium',
        sessionTypes: ['normal']
      };
    }

    const dwellTimes = viewEvents.map(e => e.dwellTime);
    const avgDwellTime = dwellTimes.reduce((sum, time) => sum + time, 0) / dwellTimes.length;

    let scrollSpeed: 'slow' | 'medium' | 'fast' = 'medium';
    if (avgDwellTime < 3000) scrollSpeed = 'fast';
    else if (avgDwellTime > 10000) scrollSpeed = 'slow';

    // Infer session types based on behavior patterns
    const sessionTypes: string[] = [];
    if (scrollSpeed === 'fast') sessionTypes.push('browsing');
    if (scrollSpeed === 'slow') sessionTypes.push('reading');
    if (avgDwellTime > 15000) sessionTypes.push('deep_dive');

    return {
      avgDwellTime,
      scrollSpeed,
      sessionTypes: sessionTypes.length > 0 ? sessionTypes : ['normal']
    };
  }

  // Update user behavior summary asynchronously
  async updateUserSummary(userId: string, newEvents: any[]): Promise<void> {
    try {
      // Store new events in database
      const behaviorEvents = newEvents.map(event => ({
        userId,
        postId: event.postId,
        eventType: event.type,
        timestamp: new Date(event.timestamp),
        dwellTime: event.dwellTime,
        metadata: event.metadata || {},
        sessionId: event.sessionId || 'unknown'
      }));

      await BehaviorEvent.insertMany(behaviorEvents);

      // Invalidate cache to force regeneration
      const redis = getRedisClient();
      const cacheKeys = [
        `behavior_summary:${userId}:1d`,
        `behavior_summary:${userId}:7d`,
        `behavior_summary:${userId}:30d`,
        `behavior_summary:${userId}:90d`
      ];

      await Promise.all(cacheKeys.map(key => redis.del(key)));

      // Update user's behavior summary in database
      const summary = await this.generateSummary(userId);
      await User.findByIdAndUpdate(userId, {
        $set: { behaviorSummary: summary }
      });

    } catch (error) {
      console.error('Error updating user behavior summary:', error);
    }
  }

  // Get behavioral insights for AI decision making
  async getBehavioralInsights(userId: string): Promise<any> {
    const summary = await this.generateSummary(userId);
    
    return {
      userProfile: {
        activityLevel: this.categorizeActivityLevel(summary.totalEvents),
        contentPreferences: {
          primaryInterests: summary.topTags.slice(0, 5),
          favoriteCreators: summary.topCreators.slice(0, 3),
          preferredFormats: summary.preferredContentTypes
        },
        engagementStyle: this.categorizeEngagementStyle(summary.engagementPatterns),
        sessionPatterns: {
          avgDuration: summary.avgSessionDuration,
          peakHours: summary.peakActivityHours,
          scrollBehavior: summary.scrollBehavior.scrollSpeed
        }
      },
      recommendations: {
        optimalPostTiming: summary.peakActivityHours,
        contentSuggestions: summary.topTags,
        engagementStrategy: this.suggestEngagementStrategy(summary),
        uiOptimizations: this.suggestUIOptimizations(summary)
      }
    };
  }

  // Categorize user activity level
  private categorizeActivityLevel(totalEvents: number): string {
    if (totalEvents < 50) return 'light';
    if (totalEvents < 200) return 'moderate';
    return 'heavy';
  }

  // Categorize engagement style
  private categorizeEngagementStyle(patterns: BehaviorSummary['engagementPatterns']): string {
    if (patterns.skipRate > 0.7) return 'browser';
    if (patterns.likeRate > 0.3) return 'engager';
    if (patterns.shareRate > 0.1) return 'sharer';
    if (patterns.commentRate > 0.05) return 'commenter';
    return 'observer';
  }

  // Suggest engagement strategy based on behavior
  private suggestEngagementStrategy(summary: BehaviorSummary): string[] {
    const strategies: string[] = [];

    if (summary.scrollBehavior.scrollSpeed === 'fast') {
      strategies.push('short_form_content', 'eye_catching_visuals');
    }

    if (summary.engagementPatterns.likeRate > 0.2) {
      strategies.push('interactive_content', 'polls_and_questions');
    }

    if (summary.peakActivityHours.length > 0) {
      strategies.push('optimal_timing', 'scheduled_content');
    }

    return strategies;
  }

  // Suggest UI optimizations based on behavior
  private suggestUIOptimizations(summary: BehaviorSummary): string[] {
    const optimizations: string[] = [];

    if (summary.scrollBehavior.scrollSpeed === 'fast') {
      optimizations.push('compact_layout', 'quick_actions');
    }

    if (summary.avgSessionDuration > 600) { // 10 minutes
      optimizations.push('deep_content_mode', 'reading_optimized');
    }

    if (summary.engagementPatterns.skipRate > 0.6) {
      optimizations.push('better_filtering', 'personalized_feed');
    }

    return optimizations;
  }

  // Get default summary for new users
  private getDefaultSummary(): BehaviorSummary {
    return {
      totalEvents: 0,
      topTags: [],
      topCreators: [],
      preferredContentTypes: [],
      avgSessionDuration: 0,
      peakActivityHours: [],
      engagementPatterns: {
        skipRate: 0,
        likeRate: 0,
        shareRate: 0,
        commentRate: 0
      },
      moodIndicators: ['neutral'],
      scrollBehavior: {
        avgDwellTime: 0,
        scrollSpeed: 'medium',
        sessionTypes: ['normal']
      }
    };
  }
}

export const behaviorAnalytics = new BehaviorAnalyticsService();
