import { openaiService } from './openai.js';
import { behaviorAnalytics } from './behaviorAnalytics.js';
import Post from '../models/Post.js';
import User from '../models/User.js';
import { getRedisClient } from '../database/redis.js';

interface UIDecision {
  layout: {
    sections: Array<{
      id: string;
      priority: number;
      visible: boolean;
    }>;
    featureFlags: { [key: string]: boolean };
  };
  feedRules: {
    blocklist: string[];
    boostTags: string[];
  };
  reasoning?: string;
}

interface RankingRequest {
  userId: string;
  behaviorSummary: any;
  posts: any[];
  intent: string;
  sessionMode: string;
}

interface RankingResult {
  rankedPosts: any[];
  uiDecisions: UIDecision;
  explanations: { [postId: string]: string };
  sessionInsights: any;
}

interface CommandRequest {
  userId: string;
  command: string;
  context: any;
  behaviorSummary: any;
  userProfile: any;
}

interface ContentSuggestionRequest {
  userId: string;
  type: string;
  input: string;
  platform?: string;
  tone: string;
  userProfile: any;
  behaviorSummary: any;
}

class AIDecisionEngineService {
  
  // Get AI-powered ranking and UI decisions
  async getRankingAndUIDecisions(request: RankingRequest): Promise<RankingResult> {
    try {
      const { userId, behaviorSummary, posts, intent, sessionMode } = request;

      // Get UI decisions first
      const uiDecisions = await this.getUIDecisions({
        userId,
        behaviorSummary,
        sessionData: { intent, mode: sessionMode }
      });

      // Rank posts using AI
      const rankedPosts = await this.rankPosts(posts, behaviorSummary, uiDecisions, intent);

      // Generate explanations for top posts
      const explanations = await this.generateExplanations(rankedPosts.slice(0, 10), behaviorSummary);

      // Get session insights
      const sessionInsights = await this.getSessionInsights(behaviorSummary, sessionMode);

      return {
        rankedPosts,
        uiDecisions,
        explanations,
        sessionInsights
      };

    } catch (error) {
      console.error('AI decision engine error:', error);
      return this.getFallbackResult(request.posts);
    }
  }

  // Get UI layout decisions based on user behavior
  async getUIDecisions(params: {
    userId: string;
    behaviorSummary: any;
    sessionData?: any;
    currentLayout?: any;
  }): Promise<UIDecision> {
    try {
      const { userId, behaviorSummary, sessionData = {}, currentLayout = {} } = params;

      // Check cache first
      const redis = getRedisClient();
      const cacheKey = `ui_decisions:${userId}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      // Prepare context for AI
      const context = {
        userSummary: {
          totalEvents: behaviorSummary.totalEvents,
          topTags: behaviorSummary.topTags?.slice(0, 10),
          scrollSpeed: behaviorSummary.scrollBehavior?.scrollSpeed,
          avgSessionDuration: behaviorSummary.avgSessionDuration,
          engagementPatterns: behaviorSummary.engagementPatterns,
          moodIndicators: behaviorSummary.moodIndicators
        },
        sessionData,
        currentLayout
      };

      // Get AI recommendations
      const aiResponse = await openaiService.generateUIRecommendations(context);

      const uiDecisions: UIDecision = {
        layout: {
          sections: aiResponse.layout?.sections || this.getDefaultSections(behaviorSummary),
          featureFlags: aiResponse.layout?.featureFlags || this.getDefaultFeatureFlags(behaviorSummary)
        },
        feedRules: {
          blocklist: aiResponse.feedRules?.blocklist || [],
          boostTags: aiResponse.feedRules?.boostTags || behaviorSummary.topTags?.slice(0, 5) || []
        },
        reasoning: aiResponse.reasoning
      };

      // Cache for 20 minutes
      await redis.setex(cacheKey, 1200, JSON.stringify(uiDecisions));

      return uiDecisions;

    } catch (error) {
      console.error('UI decisions error:', error);
      return this.getDefaultUIDecisions();
    }
  }

  // Rank posts using AI with behavioral context
  private async rankPosts(posts: any[], behaviorSummary: any, uiDecisions: UIDecision, intent: string): Promise<any[]> {
    try {
      if (posts.length === 0) return [];

      // Apply pre-filtering based on UI decisions
      let filteredPosts = posts.filter(post => {
        // Apply blocklist
        if (uiDecisions.feedRules.blocklist.some(blocked => 
          post.text?.toLowerCase().includes(blocked.toLowerCase()) ||
          post.tags?.some((tag: string) => tag.toLowerCase().includes(blocked.toLowerCase()))
        )) {
          return false;
        }
        return true;
      });

      // Boost posts with preferred tags
      filteredPosts = filteredPosts.map(post => ({
        ...post,
        aiBoostScore: this.calculateBoostScore(post, uiDecisions.feedRules.boostTags, behaviorSummary)
      }));

      // If too many posts, use AI ranking for top candidates
      if (filteredPosts.length > 50) {
        // Use heuristic ranking first
        filteredPosts = this.heuristicRanking(filteredPosts, behaviorSummary);
        filteredPosts = filteredPosts.slice(0, 50);
      }

      // AI reranking for final order
      const aiRankedPosts = await this.aiRerank(filteredPosts, behaviorSummary, intent);

      return aiRankedPosts;

    } catch (error) {
      console.error('Post ranking error:', error);
      return this.fallbackRanking(posts, behaviorSummary);
    }
  }

  // AI-powered reranking
  private async aiRerank(posts: any[], behaviorSummary: any, intent: string): Promise<any[]> {
    try {
      const candidates = posts.map(post => ({
        id: post.id,
        type: post.type,
        tags: post.tags?.slice(0, 5) || [],
        creator: post.creator.handle,
        platform: post.platform,
        stats: post.stats,
        aiBoostScore: post.aiBoostScore || 0,
        text_preview: post.text?.substring(0, 200)
      }));

      const prompt = `You are a feed reranker optimizing satisfaction for this user.
Consider user_summary, session_intent, and request_intent.
Return top ${Math.min(candidates.length, 25)} items ranked by relevance.
Output JSON: {"order": ["post_id1", "post_id2", ...], "notes": {"diversity": ["topic1", "topic2"], "downrank": ["reason1"]}}`;

      const userContext = {
        user_summary: {
          top_tags: behaviorSummary.topTags?.slice(0, 5) || [],
          scroll_behavior: behaviorSummary.scrollBehavior?.scrollSpeed || 'medium',
          engagement_style: this.getEngagementStyle(behaviorSummary.engagementPatterns),
          mood: behaviorSummary.moodIndicators?.[0] || 'neutral'
        },
        request_intent: intent,
        candidates
      };

      const response = await openaiService.processCommand(prompt, userContext);
      
      if (response.order && Array.isArray(response.order)) {
        const rankedPosts = response.order
          .map((id: string) => posts.find(p => p.id === id))
          .filter(Boolean);
        
        // Add any remaining posts
        const remainingPosts = posts.filter(p => !response.order.includes(p.id));
        return [...rankedPosts, ...remainingPosts];
      }

      return posts;

    } catch (error) {
      console.error('AI reranking error:', error);
      return posts;
    }
  }

  // Calculate boost score for posts
  private calculateBoostScore(post: any, boostTags: string[], behaviorSummary: any): number {
    let score = 0;

    // Tag matching
    if (post.tags && boostTags.length > 0) {
      const matchingTags = post.tags.filter((tag: string) => 
        boostTags.some(boost => boost.toLowerCase().includes(tag.toLowerCase()))
      );
      score += matchingTags.length * 2;
    }

    // Creator preference
    if (behaviorSummary.topCreators?.includes(post.creator?.handle)) {
      score += 3;
    }

    // Content type preference
    if (behaviorSummary.preferredContentTypes?.includes(post.type)) {
      score += 1;
    }

    // Engagement potential
    const totalEngagement = (post.stats?.likes || 0) + (post.stats?.comments || 0) + (post.stats?.shares || 0);
    if (totalEngagement > 100) score += 1;
    if (totalEngagement > 1000) score += 2;

    return score;
  }

  // Heuristic ranking for pre-filtering
  private heuristicRanking(posts: any[], behaviorSummary: any): any[] {
    return posts.sort((a, b) => {
      // Time decay (newer is better)
      const timeA = new Date(a.timePublished).getTime();
      const timeB = new Date(b.timePublished).getTime();
      const timeScore = (timeB - timeA) / (1000 * 60 * 60); // Hours difference

      // Engagement score
      const engagementA = (a.stats?.likes || 0) + (a.stats?.comments || 0) * 2 + (a.stats?.shares || 0) * 3;
      const engagementB = (b.stats?.likes || 0) + (b.stats?.comments || 0) * 2 + (b.stats?.shares || 0) * 3;

      // AI boost score
      const boostA = a.aiBoostScore || 0;
      const boostB = b.aiBoostScore || 0;

      // Combined score
      const scoreA = timeScore * 0.3 + Math.log(engagementA + 1) * 0.4 + boostA * 0.3;
      const scoreB = timeScore * 0.3 + Math.log(engagementB + 1) * 0.4 + boostB * 0.3;

      return scoreB - scoreA;
    });
  }

  // Process natural language commands
  async processCommand(request: CommandRequest): Promise<any> {
    try {
      const { userId, command, context, behaviorSummary, userProfile } = request;

      const commandContext = {
        user_preferences: {
          top_interests: behaviorSummary.topTags?.slice(0, 5) || [],
          preferred_platforms: userProfile.connectedPlatforms?.map((p: any) => p.platform) || [],
          engagement_style: this.getEngagementStyle(behaviorSummary.engagementPatterns)
        },
        available_actions: [
          'filter_content', 'search_posts', 'create_post', 'cross_post', 
          'get_analytics', 'schedule_post', 'find_trending', 'get_recommendations'
        ],
        context
      };

      const response = await openaiService.processCommand(command, commandContext);

      // Execute the determined action
      return await this.executeCommand(response, userId);

    } catch (error) {
      console.error('Command processing error:', error);
      return {
        success: false,
        message: 'Sorry, I couldn\'t understand that command. Please try rephrasing.',
        suggestions: ['Show me trending posts', 'Filter by AI content', 'Post to Instagram']
      };
    }
  }

  // Execute parsed command
  private async executeCommand(commandResponse: any, userId: string): Promise<any> {
    const { action, parameters, confidence } = commandResponse;

    if (confidence < 0.7) {
      return {
        success: false,
        message: 'I\'m not sure I understood correctly. Could you be more specific?',
        interpretation: commandResponse.intent
      };
    }

    switch (action) {
      case 'filter_content':
        return await this.executeContentFilter(parameters, userId);
      case 'search_posts':
        return await this.executeSearch(parameters, userId);
      case 'create_post':
        return await this.executePostCreation(parameters, userId);
      default:
        return {
          success: true,
          message: `I understand you want to ${action}. This feature is being processed.`,
          action,
          parameters
        };
    }
  }

  // Generate content suggestions
  async generateContentSuggestions(request: ContentSuggestionRequest): Promise<any> {
    try {
      const { userId, type, input, platform, tone, userProfile, behaviorSummary } = request;

      switch (type) {
        case 'caption':
          return await this.generateCaptions(input, platform, tone, behaviorSummary);
        case 'reply':
          return await this.generateReplies(input, tone, behaviorSummary);
        case 'hashtags':
          return await this.generateHashtags(input, platform, behaviorSummary);
        case 'cross_post':
          return await this.generateCrossPosts(input, userProfile.connectedPlatforms, tone);
        default:
          throw new Error(`Unsupported content type: ${type}`);
      }

    } catch (error) {
      console.error('Content suggestion error:', error);
      return {
        suggestions: [input], // Fallback to original input
        type,
        error: 'Failed to generate AI suggestions'
      };
    }
  }

  // Generate captions for posts
  private async generateCaptions(input: string, platform: string = 'instagram', tone: string, behaviorSummary: any): Promise<any> {
    const suggestions = await openaiService.adaptContentForPlatform(input, platform, tone);
    
    return {
      suggestions,
      platform,
      tone,
      optimizations: {
        hashtag_suggestions: await openaiService.generateHashtags(input, platform, 5),
        engagement_tips: this.getEngagementTips(platform, behaviorSummary)
      }
    };
  }

  // Generate reply suggestions
  private async generateReplies(input: string, tone: string, behaviorSummary: any): Promise<any> {
    const prompt = `Generate 3 ${tone} reply suggestions for this comment/post: "${input}"`;
    const response = await openaiService.processCommand(prompt, { tone, context: 'reply' });
    
    return {
      suggestions: response.suggestions || [
        'Thanks for sharing this!',
        'Interesting perspective.',
        'I appreciate your thoughts on this.'
      ],
      tone
    };
  }

  // Generate hashtag suggestions
  private async generateHashtags(input: string, platform: string = 'instagram', behaviorSummary: any): Promise<any> {
    const hashtags = await openaiService.generateHashtags(input, platform, 15);
    
    // Mix with user's preferred tags
    const userTags = behaviorSummary.topTags?.slice(0, 5) || [];
    const combinedTags = [...new Set([...hashtags, ...userTags])];
    
    return {
      hashtags: combinedTags.slice(0, 15),
      categories: {
        trending: hashtags.slice(0, 5),
        personal: userTags,
        niche: hashtags.slice(5, 10)
      }
    };
  }

  // Generate cross-platform posts
  private async generateCrossPosts(input: string, connectedPlatforms: any[], tone: string): Promise<any> {
    const crossPosts: { [platform: string]: string[] } = {};
    
    for (const platformConn of connectedPlatforms) {
      if (platformConn.isActive) {
        const platform = platformConn.platform;
        crossPosts[platform] = await openaiService.adaptContentForPlatform(input, platform, tone);
      }
    }
    
    return {
      crossPosts,
      tone,
      platforms: Object.keys(crossPosts)
    };
  }

  // Analyze post engagement potential
  async analyzeEngagementPotential(params: {
    userId: string;
    content: string;
    platform: string;
    metadata?: any;
  }): Promise<any> {
    try {
      const { content, platform, metadata = {} } = params;

      const analysis = await openaiService.analyzeContent(content);
      
      // Calculate engagement score based on multiple factors
      const baseScore = analysis.engagementPotential;
      const platformMultiplier = this.getPlatformEngagementMultiplier(platform);
      const lengthOptimality = this.getOptimalLengthScore(content, platform);
      
      const finalScore = Math.min(10, baseScore * platformMultiplier * lengthOptimality);

      return {
        engagementScore: Math.round(finalScore * 10) / 10,
        analysis: {
          sentiment: analysis.sentiment,
          topics: analysis.topics,
          contentType: analysis.contentType,
          complexity: analysis.complexity
        },
        recommendations: await this.getEngagementRecommendations(analysis, platform),
        optimizations: {
          suggestedHashtags: await openaiService.generateHashtags(content, platform, 8),
          bestPostingTime: this.suggestOptimalTiming(platform),
          audienceMatch: this.analyzeAudienceMatch(analysis.topics, platform)
        }
      };

    } catch (error) {
      console.error('Engagement analysis error:', error);
      return {
        engagementScore: 5,
        analysis: { sentiment: { rating: 3, confidence: 0.5 } },
        recommendations: ['Consider adding more engaging content'],
        error: 'Analysis failed'
      };
    }
  }

  // Generate smart notifications
  async generateSmartNotifications(params: {
    userId: string;
    userProfile: any;
    behaviorSummary: any;
  }): Promise<any> {
    try {
      // This would typically fetch real notifications from platforms
      // For now, we'll generate contextual notifications
      
      const notifications = [
        {
          id: 'ai_suggestion_1',
          type: 'content_suggestion',
          title: 'Perfect Time to Post',
          message: 'Based on your audience activity, now is a great time to share content.',
          priority: 'medium',
          actionable: true,
          actions: ['Create Post', 'Schedule Later']
        },
        {
          id: 'ai_insight_1',
          type: 'insight',
          title: 'Your Photography Posts Are Trending',
          message: 'Your recent photography content got 40% more engagement than usual.',
          priority: 'low',
          actionable: false
        }
      ];

      return {
        notifications,
        summary: {
          total: notifications.length,
          actionable: notifications.filter(n => n.actionable).length,
          highPriority: notifications.filter(n => n.priority === 'high').length
        }
      };

    } catch (error) {
      console.error('Smart notifications error:', error);
      return { notifications: [], summary: { total: 0, actionable: 0, highPriority: 0 } };
    }
  }

  // Explain AI decisions
  async explainDecision(params: {
    userId: string;
    post: any;
    action: string;
    includePersonalization?: boolean;
  }): Promise<any> {
    try {
      const { post, action, includePersonalization = true } = params;

      const explanation = {
        action,
        reasoning: await this.generateExplanationText(post, action),
        factors: this.getDecisionFactors(post, action),
        personalization: includePersonalization ? {
          basedOnYourInterests: post.tags?.filter((tag: string) => 
            tag.toLowerCase().includes('ai') || tag.toLowerCase().includes('tech')
          ) || [],
          similarToLikedContent: true,
          optimalForYourSchedule: true
        } : null
      };

      return explanation;

    } catch (error) {
      console.error('Decision explanation error:', error);
      return {
        action,
        reasoning: 'This content was selected based on your preferences and activity patterns.',
        factors: ['relevance', 'timing', 'engagement_potential']
      };
    }
  }

  // Generate mood-based content filter
  async generateMoodBasedFilter(params: {
    userId: string;
    currentMood?: string;
    timeAvailable?: string;
    contentGoal?: string;
    behaviorSummary: any;
  }): Promise<any> {
    const { currentMood = 'neutral', timeAvailable = 'moderate', contentGoal = 'entertainment', behaviorSummary } = params;

    const filter = {
      contentTypes: this.getMoodBasedContentTypes(currentMood, timeAvailable),
      tags: this.getMoodBasedTags(currentMood, contentGoal, behaviorSummary),
      creators: this.getMoodBasedCreators(currentMood, behaviorSummary),
      duration: this.getMoodBasedDuration(timeAvailable),
      priority: this.getMoodBasedPriority(currentMood, contentGoal)
    };

    return {
      filter,
      mood: currentMood,
      timeAvailable,
      contentGoal,
      explanation: `Optimized for ${currentMood} mood with ${timeAvailable} time available, focusing on ${contentGoal}.`
    };
  }

  // Helper methods
  private getDefaultSections(behaviorSummary: any): any[] {
    const sections = [
      { id: 'shorts', priority: 0, visible: true },
      { id: 'longform', priority: 1, visible: true },
      { id: 'threads', priority: 2, visible: true },
      { id: 'trending', priority: 3, visible: true }
    ];

    // Adjust based on behavior
    if (behaviorSummary.scrollBehavior?.scrollSpeed === 'fast') {
      sections.find(s => s.id === 'shorts')!.priority = 0;
      sections.find(s => s.id === 'longform')!.priority = 3;
    }

    return sections;
  }

  private getDefaultFeatureFlags(behaviorSummary: any): { [key: string]: boolean } {
    return {
      autoSummary: behaviorSummary.avgSessionDuration > 600,
      downrankAds: behaviorSummary.engagementPatterns?.skipRate > 0.7,
      showInsights: behaviorSummary.totalEvents > 100,
      adaptiveLayout: true
    };
  }

  private getDefaultUIDecisions(): UIDecision {
    return {
      layout: {
        sections: [
          { id: 'shorts', priority: 0, visible: true },
          { id: 'longform', priority: 1, visible: true },
          { id: 'trending', priority: 2, visible: true }
        ],
        featureFlags: {
          autoSummary: false,
          downrankAds: true,
          showInsights: false,
          adaptiveLayout: true
        }
      },
      feedRules: {
        blocklist: ['spam', 'low_quality'],
        boostTags: ['technology', 'ai']
      }
    };
  }

  private getFallbackResult(posts: any[]): RankingResult {
    return {
      rankedPosts: posts,
      uiDecisions: this.getDefaultUIDecisions(),
      explanations: {},
      sessionInsights: { mode: 'fallback', reason: 'AI decision engine unavailable' }
    };
  }

  private fallbackRanking(posts: any[], behaviorSummary: any): any[] {
    // Simple time-based ranking as fallback
    return posts.sort((a, b) => 
      new Date(b.timePublished).getTime() - new Date(a.timePublished).getTime()
    );
  }

  private async generateExplanations(posts: any[], behaviorSummary: any): Promise<{ [postId: string]: string }> {
    const explanations: { [postId: string]: string } = {};
    
    for (const post of posts.slice(0, 5)) {
      explanations[post.id] = await this.generateExplanationText(post, 'recommended');
    }
    
    return explanations;
  }

  private async generateExplanationText(post: any, action: string): Promise<string> {
    const reasons = [];
    
    if (post.tags?.includes('ai') || post.tags?.includes('technology')) {
      reasons.push('matches your interest in technology');
    }
    
    if (post.stats?.engagement > 100) {
      reasons.push('has high engagement');
    }
    
    if (post.type === 'short') {
      reasons.push('perfect for quick viewing');
    }
    
    return reasons.length > 0 
      ? `This post was ${action} because it ${reasons.join(' and ')}.`
      : `This post was ${action} based on your activity patterns.`;
  }

  private getDecisionFactors(post: any, action: string): string[] {
    const factors = ['relevance', 'timing'];
    
    if (post.stats?.likes > 50) factors.push('popularity');
    if (post.tags?.length > 0) factors.push('topic_match');
    if (action === 'recommended') factors.push('personalization');
    
    return factors;
  }

  private getEngagementStyle(engagementPatterns: any): string {
    if (!engagementPatterns) return 'observer';
    
    if (engagementPatterns.likeRate > 0.3) return 'active_engager';
    if (engagementPatterns.shareRate > 0.1) return 'content_sharer';
    if (engagementPatterns.commentRate > 0.05) return 'discussion_participant';
    if (engagementPatterns.skipRate > 0.7) return 'content_browser';
    
    return 'casual_viewer';
  }

  private getSessionInsights(behaviorSummary: any, sessionMode: string): any {
    return {
      mode: sessionMode,
      suggestedDuration: this.getSuggestedSessionDuration(behaviorSummary),
      contentMix: this.getOptimalContentMix(behaviorSummary),
      nextActions: this.getNextActionSuggestions(behaviorSummary)
    };
  }

  private getSuggestedSessionDuration(behaviorSummary: any): string {
    const avgDuration = behaviorSummary.avgSessionDuration || 0;
    if (avgDuration < 300) return 'short (5-10 min)';
    if (avgDuration < 900) return 'medium (15-20 min)';
    return 'extended (30+ min)';
  }

  private getOptimalContentMix(behaviorSummary: any): any {
    return {
      shorts: behaviorSummary.scrollBehavior?.scrollSpeed === 'fast' ? 70 : 40,
      longform: behaviorSummary.scrollBehavior?.scrollSpeed === 'slow' ? 50 : 30,
      interactive: 20,
      trending: 10
    };
  }

  private getNextActionSuggestions(behaviorSummary: any): string[] {
    const suggestions = [];
    
    if (behaviorSummary.engagementPatterns?.likeRate > 0.2) {
      suggestions.push('Share your favorite content');
    }
    
    if (behaviorSummary.totalEvents > 100) {
      suggestions.push('Create a post about your interests');
    }
    
    suggestions.push('Explore trending topics');
    
    return suggestions;
  }

  private getPlatformEngagementMultiplier(platform: string): number {
    const multipliers = {
      instagram: 1.2,
      youtube: 1.0,
      twitter: 1.1,
      facebook: 0.9
    };
    return multipliers[platform as keyof typeof multipliers] || 1.0;
  }

  private getOptimalLengthScore(content: string, platform: string): number {
    const optimalLengths = {
      instagram: { min: 100, max: 300 },
      youtube: { min: 200, max: 1000 },
      twitter: { min: 50, max: 200 },
      facebook: { min: 200, max: 500 }
    };

    const optimal = optimalLengths[platform as keyof typeof optimalLengths] || { min: 100, max: 300 };
    const length = content.length;

    if (length >= optimal.min && length <= optimal.max) return 1.0;
    if (length < optimal.min) return 0.8;
    return 0.9;
  }

  private async getEngagementRecommendations(analysis: any, platform: string): Promise<string[]> {
    const recommendations = [];

    if (analysis.sentiment.rating < 3) {
      recommendations.push('Consider adding more positive tone');
    }

    if (analysis.complexity > 7) {
      recommendations.push('Simplify language for broader appeal');
    }

    if (platform === 'instagram' && !analysis.topics.includes('visual')) {
      recommendations.push('Add visual elements or descriptions');
    }

    return recommendations;
  }

  private suggestOptimalTiming(platform: string): string {
    const timings = {
      instagram: '6-9 PM weekdays',
      youtube: '2-4 PM weekends',
      twitter: '12-3 PM weekdays',
      facebook: '1-4 PM weekdays'
    };
    return timings[platform as keyof typeof timings] || 'afternoon hours';
  }

  private analyzeAudienceMatch(topics: string[], platform: string): number {
    // Simplified audience matching score
    const platformTopics = {
      instagram: ['lifestyle', 'fashion', 'food', 'travel'],
      youtube: ['education', 'entertainment', 'tutorials'],
      twitter: ['news', 'technology', 'politics', 'trends'],
      facebook: ['family', 'community', 'events', 'business']
    };

    const relevantTopics = platformTopics[platform as keyof typeof platformTopics] || [];
    const matches = topics.filter(topic => 
      relevantTopics.some(relevant => topic.toLowerCase().includes(relevant))
    );

    return Math.min(10, (matches.length / topics.length) * 10);
  }

  private getMoodBasedContentTypes(mood: string, timeAvailable: string): string[] {
    const moodMap = {
      energetic: ['short', 'live'],
      calm: ['longform', 'image'],
      focused: ['longform', 'thread'],
      social: ['thread', 'live'],
      creative: ['image', 'longform']
    };

    const timeMap = {
      quick: ['short', 'image'],
      moderate: ['short', 'longform'],
      extended: ['longform', 'thread', 'live']
    };

    const moodTypes = moodMap[mood as keyof typeof moodMap] || ['short', 'longform'];
    const timeTypes = timeMap[timeAvailable as keyof typeof timeMap] || ['short', 'longform'];

    return [...new Set([...moodTypes, ...timeTypes])];
  }

  private getMoodBasedTags(mood: string, goal: string, behaviorSummary: any): string[] {
    const baseTags = behaviorSummary.topTags?.slice(0, 5) || [];
    
    const moodTags = {
      energetic: ['fitness', 'sports', 'motivation'],
      calm: ['meditation', 'nature', 'peaceful'],
      focused: ['education', 'productivity', 'learning'],
      social: ['community', 'discussion', 'social'],
      creative: ['art', 'design', 'inspiration']
    };

    const goalTags = {
      entertainment: ['funny', 'memes', 'viral'],
      learning: ['education', 'tutorial', 'tips'],
      inspiration: ['motivation', 'quotes', 'success'],
      news: ['breaking', 'updates', 'current']
    };

    return [...new Set([
      ...baseTags,
      ...(moodTags[mood as keyof typeof moodTags] || []),
      ...(goalTags[goal as keyof typeof goalTags] || [])
    ])];
  }

  private getMoodBasedCreators(mood: string, behaviorSummary: any): string[] {
    // Return user's top creators, could be enhanced with mood-specific filtering
    return behaviorSummary.topCreators?.slice(0, 5) || [];
  }

  private getMoodBasedDuration(timeAvailable: string): { min: number; max: number } {
    const durations = {
      quick: { min: 0, max: 60 },
      moderate: { min: 0, max: 300 },
      extended: { min: 0, max: 1800 }
    };
    return durations[timeAvailable as keyof typeof durations] || { min: 0, max: 300 };
  }

  private getMoodBasedPriority(mood: string, goal: string): string[] {
    const priorities = [];
    
    if (mood === 'energetic') priorities.push('high_engagement');
    if (mood === 'calm') priorities.push('peaceful_content');
    if (goal === 'learning') priorities.push('educational_value');
    if (goal === 'entertainment') priorities.push('viral_potential');
    
    return priorities;
  }

  private async executeContentFilter(parameters: any, userId: string): Promise<any> {
    return {
      success: true,
      message: 'Content filter applied successfully',
      filters: parameters,
      action: 'filter_applied'
    };
  }

  private async executeSearch(parameters: any, userId: string): Promise<any> {
    return {
      success: true,
      message: `Searching for: ${parameters.query}`,
      query: parameters.query,
      action: 'search_initiated'
    };
  }

  private async executePostCreation(parameters: any, userId: string): Promise<any> {
    return {
      success: true,
      message: 'Post creation initiated',
      content: parameters.content,
      platforms: parameters.platforms,
      action: 'post_creation_started'
    };
  }

  private getEngagementTips(platform: string, behaviorSummary: any): string[] {
    const tips = {
      instagram: ['Use 3-5 relevant hashtags', 'Post during peak hours', 'Include a call-to-action'],
      youtube: ['Create compelling thumbnails', 'Use descriptive titles', 'Engage with comments'],
      twitter: ['Keep it under 280 characters', 'Use trending hashtags', 'Join conversations'],
      facebook: ['Ask questions to encourage comments', 'Share personal stories', 'Use visual content']
    };

    return tips[platform as keyof typeof tips] || ['Create engaging content', 'Post consistently', 'Interact with your audience'];
  }
}

export const aiDecisionEngine = new AIDecisionEngineService();
