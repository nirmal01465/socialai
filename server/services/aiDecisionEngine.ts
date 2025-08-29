import { OpenAI } from 'openai';
import { behaviorAnalytics } from './behaviorAnalytics.js';
import { contentNormalizer } from './contentNormalizer.js';
import { getRedisClient } from '../database/redis.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface DecisionContext {
  userId: string;
  behaviorSummary: any;
  contentCandidates?: any[];
  sessionContext?: any;
  intent?: string;
}

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
}

// Revolutionary Multi-Agent AI Decision Engine
class AIDecisionEngine {
  private async callOpenAI(prompt: string, systemPrompt: string, maxTokens = 2000): Promise<any> {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: maxTokens,
        temperature: 0.3,
        response_format: { type: "json_object" }
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error('No response from OpenAI');

      return JSON.parse(content);
    } catch (error) {
      console.error('AI Decision Engine error:', error);
      return this.getIntelligentFallback(prompt, systemPrompt);
    }
  }

  private getIntelligentFallback(prompt: string, systemPrompt: string): any {
    // Intelligent fallback with contextual defaults
    if (systemPrompt.includes('UI Intelligence')) {
      return {
        version: "1.0",
        layout: {
          sections: [
            { id: "unified_feed", priority: 0, visible: true, style: "adaptive" },
            { id: "trending", priority: 1, visible: true, style: "compact" },
            { id: "discover", priority: 2, visible: true, style: "minimal" }
          ],
          feedColumns: 1,
          cardStyle: "detailed",
          showSidebar: false,
          adaptiveFeatures: {
            autoSummary: true,
            contextualSuggestions: true,
            smartNotifications: true,
            realTimeAdaptation: true
          }
        },
        featureFlags: {
          commandBar: true,
          whyThisPost: true,
          sessionModes: true,
          creatorAffinity: true
        },
        feedRules: {
          blocklist: ["spam", "low_quality"],
          boostTags: ["trending", "ai", "technology"],
          preferredContentTypes: ["video", "image", "article"],
          diversityWeight: 0.7,
          moodOptimization: true
        }
      };
    }
    
    if (systemPrompt.includes('Command Intelligence')) {
      return {
        success: true,
        action: "acknowledge",
        parameters: { message: "Command understood but AI temporarily offline" },
        explanation: "Using intelligent defaults while AI reconnects",
        suggestions: ["Try 'show trending posts'", "Filter by topic", "Create new post"],
        confidence: 0.8
      };
    }
    
    return { error: "AI temporarily unavailable", fallback: true };
  }

  // ============ AGENT 1: UI INTELLIGENCE AGENT ============
  async generateUIDecisions(context: DecisionContext): Promise<UIDecision> {
    const systemPrompt = `You are the UI Intelligence Agent for a revolutionary social media super-app.

MISSION: Generate adaptive UI configurations that transform in real-time based on user behavior patterns.

BEHAVIORAL ANALYSIS CAPABILITIES:
- Detect user energy levels from scroll velocity and interaction patterns
- Identify session intent (quick browsing, deep engagement, discovery, focus)
- Analyze cognitive load tolerance from skip rates and dwell times
- Predict optimal content density and visual hierarchy
- Adapt to time-of-day and contextual preferences

REVOLUTIONARY ADAPTATIONS:
- MORNING (6-9am): News priority, compact layout, trending emphasis
- WORK HOURS (9-5pm): Minimal distractions, quick-scan cards, productivity focus
- EVENING (5-9pm): Rich media, relaxed browsing, entertainment priority
- NIGHT (9pm+): Dark mode optimization, longer content, discovery mode

REAL-TIME INTELLIGENCE:
- Fast scroll (>3 screens/sec) → Switch to minimal cards, reduce text
- Long dwell (>30s/post) → Enable detailed view, show related content
- High skip rate (>70%) → Increase diversity, reset recommendations
- Low engagement → Inject trending content, boost familiar creators

SESSION MODES:
- Quick Hits: Bite-sized content, high variety, minimal friction
- Deep Dive: Longer content, topic clusters, educational focus  
- Discovery: 40% outside comfort zone, new creators, emerging trends
- Focus: Single topic exploration, expert content, learning paths

OUTPUT: Valid JSON matching UIDecision interface. Be revolutionary in adaptations while maintaining usability.`;

    const userPrompt = JSON.stringify({
      userId: context.userId,
      behaviorSummary: context.behaviorSummary,
      sessionContext: {
        ...context.sessionContext,
        timeOfDay: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
        deviceType: "mobile",
        sessionDuration: context.sessionContext?.duration || 0,
        scrollVelocity: context.behaviorSummary?.scrollBehavior?.scrollSpeed || "medium",
        engagementRate: context.behaviorSummary?.engagementPatterns?.engagementRate || 0.1
      },
      currentMood: this.inferMoodFromBehavior(context.behaviorSummary),
      timestamp: new Date().toISOString()
    });

    const decision = await this.callOpenAI(userPrompt, systemPrompt);
    
    // Cache UI decisions for 15 minutes or until behavior significantly changes
    const redis = getRedisClient();
    await redis.setex(`ui_decisions:${context.userId}`, 900, JSON.stringify(decision));

    return decision;
  }

  // ============ AGENT 2: CONTENT RANKING INTELLIGENCE ============
  async rankContent(context: DecisionContext): Promise<{
    rankedIds: string[];
    explanations: Record<string, string>;
    diversityScore: number;
    sessionOptimization: string;
    confidenceScore: number;
    adaptiveInsights: any;
  }> {
    const systemPrompt = `You are the Content Ranking Intelligence Agent.

MISSION: Create the perfect content mix for maximum user satisfaction using advanced behavioral analysis.

RANKING ALGORITHM (Revolutionary Multi-Factor):
1. BEHAVIORAL ALIGNMENT (35%):
   - Match proven interests from engagement history
   - Detect emerging interest patterns from recent behavior
   - Consider time-based preference shifts (morning news vs evening entertainment)
   - Factor in mood indicators from interaction patterns

2. TEMPORAL INTELLIGENCE (25%):
   - Trending momentum analysis (velocity of engagement growth)
   - Freshness with context (breaking news vs evergreen content)
   - Personal timing optimization (when user typically engages with similar content)
   - Platform-specific peak times

3. CREATOR AFFINITY (20%):
   - Historical engagement with specific creators
   - Parasocial relationship strength indicators
   - Creator consistency and quality scores
   - Cross-platform creator presence

4. DIVERSITY INJECTION (15%):
   - Prevent filter bubbles with intelligent variety
   - Introduce adjacent interests with high success probability
   - Serendipity moments for discovery
   - Balanced perspective representation

5. QUALITY SIGNALS (5%):
   - Content completion rates
   - Engagement quality (comments vs passive consumption)
   - User satisfaction indicators
   - Anti-spam and authenticity markers

REVOLUTIONARY FEATURES:
- MOOD-BASED RANKING: Adapt content emotional tone to user's current state
- COGNITIVE LOAD BALANCING: Mix heavy and light content based on user capacity
- ATTENTION SPAN OPTIMIZATION: Vary content length based on session patterns
- CROSS-PLATFORM INTELLIGENCE: Leverage behavior from all connected platforms

SESSION OPTIMIZATION STRATEGIES:
- "Dopamine Regulation": Balance instant gratification with meaningful content
- "Learning Path Creation": Build knowledge progression through related content
- "Social Discovery": Surface content from user's extended network
- "Trend Participation": Enable user to join relevant conversations

OUTPUT: JSON with rankedIds array, detailed explanations, diversityScore (0-1), sessionOptimization strategy, confidenceScore, adaptiveInsights.`;

    const userPrompt = JSON.stringify({
      behaviorSummary: {
        ...context.behaviorSummary,
        recentEngagements: context.behaviorSummary?.recentEngagements?.slice(0, 20),
        moodIndicators: this.extractMoodIndicators(context.behaviorSummary),
        attentionSpan: this.calculateAttentionSpan(context.behaviorSummary),
        cognitiveLoad: this.assessCognitiveLoad(context.sessionContext)
      },
      candidates: context.contentCandidates?.slice(0, 100).map(post => ({
        id: post.id,
        type: post.type,
        platform: post.platform,
        creator: post.creator,
        tags: post.tags?.slice(0, 8),
        stats: post.stats,
        content_length: post.text?.length || 0,
        media_type: post.content?.media?.[0]?.type,
        sentiment: post.sentiment || 0,
        complexity_score: this.calculateComplexity(post),
        freshness_hours: this.getContentAge(post.timePublished)
      })),
      intent: context.intent || 'balanced_discovery',
      sessionContext: context.sessionContext,
      currentTime: new Date().toISOString()
    });

    return await this.callOpenAI(userPrompt, systemPrompt, 2500);
  }

  // ============ AGENT 3: COMMAND INTELLIGENCE AGENT ============
  async processCommand(context: DecisionContext & { command: string }): Promise<{
    success: boolean;
    action: string;
    parameters: any;
    explanation: string;
    suggestions: string[];
    confidence: number;
    executionPlan: any;
  }> {
    const systemPrompt = `You are the Command Intelligence Agent for natural language social media control.

MISSION: Transform user intent into precise, executable actions with revolutionary understanding capabilities.

SUPPORTED COMMAND CATEGORIES:

1. CONTENT DISCOVERY & FILTERING:
   - "Show me viral AI videos under 3 minutes"
   - "Hide all crypto posts for next week"
   - "Find posts about photography with high engagement"
   - "Only show content from my close friends"
   - "Trending posts in my interests from last 2 hours"

2. CONTENT CREATION & PUBLISHING:
   - "Draft a witty reply to this comment"
   - "Cross-post this to Twitter with professional tone"
   - "Create Instagram caption for my beach photo"
   - "Schedule post about my project for peak engagement time"
   - "Generate hashtags for fitness content"

3. ACCOUNT MANAGEMENT & AUTOMATION:
   - "Mute brand posts but keep creator content"
   - "Boost all posts from @tech_influencer"
   - "Auto-like posts from my close friends"
   - "Set up notifications for mentions of my brand"
   - "Follow accounts similar to @example_user"

4. ANALYTICS & INSIGHTS:
   - "Why am I seeing this post?"
   - "Show my engagement trends this week"
   - "What content performs best for me?"
   - "Analyze sentiment of comments on my latest post"
   - "Predict performance of this draft"

5. UI & EXPERIENCE CONTROL:
   - "Switch to focus mode for next hour"
   - "Hide stories and show only posts"
   - "Enable dark mode with minimal distractions"
   - "Show me the learning path view"
   - "Compact layout for quick browsing"

INTELLIGENCE FEATURES:
- CONTEXT AWARENESS: Understand references to "this", "that", previous conversation
- TEMPORAL UNDERSTANDING: Process relative time ("last week", "morning posts")
- INTENT DISAMBIGUATION: Clarify ambiguous commands with smart suggestions
- SAFETY VALIDATION: Prevent harmful or policy-violating commands
- EXECUTION PLANNING: Break complex commands into sequential steps

RESPONSE INTELLIGENCE:
- Provide clear explanation of what will happen
- Suggest related commands user might want
- Estimate execution time and success probability
- Include safety warnings for potentially destructive actions

OUTPUT: JSON with success status, action type, parameters object, explanation, suggestions array, confidence score (0-1), executionPlan object.`;

    const userPrompt = JSON.stringify({
      command: context.command,
      userContext: {
        behaviorSummary: context.behaviorSummary,
        connectedPlatforms: context.sessionContext?.connectedPlatforms || [],
        recentPosts: context.sessionContext?.recentPosts?.slice(0, 5) || [],
        currentFeedView: context.sessionContext?.currentView || "unified_feed",
        activeFilters: context.sessionContext?.activeFilters || []
      },
      availableActions: [
        'filter_content', 'search_posts', 'create_content', 'cross_post',
        'manage_account', 'get_analytics', 'schedule_content', 'find_trending',
        'get_recommendations', 'ui_control', 'automation_setup'
      ],
      timestamp: new Date().toISOString()
    });

    return await this.callOpenAI(userPrompt, systemPrompt);
  }

  // ============ AGENT 4: CREATOR INTELLIGENCE AGENT ============
  async generateContentSuggestions(context: DecisionContext & {
    type: 'caption' | 'reply' | 'hashtags' | 'cross_post' | 'story' | 'thread';
    input: string;
    platform?: string;
    tone?: string;
  }): Promise<{
    suggestions: string[];
    type: string;
    platform?: string;
    tone: string;
    optimizationTips: string[];
    estimatedPerformance: Record<string, number>;
    viralPotential: number;
    brandSafety: number;
  }> {
    const systemPrompt = `You are the Creator Intelligence Agent specializing in high-performing, platform-native content generation.

MISSION: Generate viral-potential content that amplifies user voice while maximizing engagement and maintaining authenticity.

PLATFORM EXPERTISE:

INSTAGRAM:
- Visual storytelling with emotional hooks
- Strategic hashtag mixing (trending + niche + branded)
- Story-to-post content funnel optimization
- Carousel content for maximum engagement
- Reels optimization for algorithm favorability

TWITTER/X:
- Thread narrative structure for complex ideas
- Reply optimization for conversation starters
- Trending topic integration with authentic voice
- Quote tweet strategy for amplification
- Space-friendly content for audio discussions

YOUTUBE:
- Hook-heavy descriptions for click-through
- Community tab engagement optimization
- Comment-to-content feedback loops
- Shorts optimization for discovery
- Long-form content value proposition

TIKTOK:
- Trend adaptation with unique spin
- Audio-visual synchronization mastery
- Viral mechanic integration (challenges, sounds)
- Generation-specific humor and references
- Cross-pollination with other platforms

LINKEDIN:
- Thought leadership positioning
- Industry insight presentation
- Professional storytelling
- Networking conversation starters
- Credibility establishment

ADVANCED OPTIMIZATION FACTORS:

TIMING INTELLIGENCE:
- Platform-specific peak engagement windows
- User's audience activity patterns
- Trending topic momentum analysis
- Cross-platform posting coordination

VIRAL MECHANICS:
- Emotional resonance triggers
- Shareability factor optimization
- Discussion catalyst integration
- Meme potential assessment
- Controversy balance (engagement vs safety)

BRAND VOICE CONSISTENCY:
- Tone adaptation while maintaining authenticity
- Cross-platform voice translation
- Audience expectation management
- Personal brand evolution tracking

PERFORMANCE PREDICTION:
- Engagement rate estimation (likes, comments, shares)
- Reach potential based on content quality
- Virality probability scoring
- Controversy risk assessment
- Brand safety compliance verification

OUTPUT: JSON with suggestions array (3-5 variants), optimizationTips, estimatedPerformance metrics, viralPotential score (0-1), brandSafety score (0-1).`;

    const userPrompt = JSON.stringify({
      type: context.type,
      input: context.input,
      platform: context.platform || 'instagram',
      tone: context.tone || 'authentic',
      userProfile: {
        behaviorSummary: context.behaviorSummary,
        brandVoice: context.sessionContext?.brandVoice || 'professional_friendly',
        audienceInsights: this.getAudienceInsights(context.behaviorSummary),
        contentHistory: context.sessionContext?.recentPosts?.slice(0, 10) || []
      },
      contextualFactors: {
        currentTrends: await this.getCurrentTrends(),
        timeOfDay: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
        seasonalContext: this.getSeasonalContext()
      },
      timestamp: new Date().toISOString()
    });

    return await this.callOpenAI(userPrompt, systemPrompt, 2000);
  }

  // ============ AGENT 5: NOTIFICATION INTELLIGENCE AGENT ============
  async processNotifications(notifications: any[]): Promise<{
    bundles: Array<{
      id: string;
      priority: number;
      title: string;
      summary: string;
      actions: Array<{ label: string; action: string; type: 'primary' | 'secondary' }>;
      items: any[];
      urgency: 'low' | 'medium' | 'high';
      category: string;
      smartInsights: any;
    }>;
    totalCount: number;
    nextCheckRecommended: string;
    attentionScore: number;
  }> {
    const systemPrompt = `You are the Notification Intelligence Agent with revolutionary attention management capabilities.

MISSION: Transform notification chaos into actionable, prioritized insights that respect user attention while maximizing important connections.

REVOLUTIONARY BUNDLING STRATEGY:

PRIORITY INTELLIGENCE:
- CRITICAL (Immediate attention): Direct messages from VIPs, mentions in viral content, business opportunities
- HIGH (Within hour): Comments on recent posts, mentions by followed accounts, trending topic opportunities
- MEDIUM (Daily digest): Likes from engaged followers, new followers with potential, content performance milestones
- LOW (Weekly summary): General likes, algorithmic suggestions, promotional content

BEHAVIORAL ADAPTATION:
- User Response Patterns: Learn optimal notification timing from historical responses
- Attention Capacity: Adjust notification density based on user stress indicators
- Interaction Preference: Prioritize notification types user actually acts upon
- Context Awareness: Suppress low-priority notifications during focus sessions

INTELLIGENT GROUPING:
- CONVERSATION THREADS: Bundle all activity from single post/comment chain
- CREATOR CLUSTERS: Group notifications from same creator across platforms
- TOPIC COHERENCE: Bundle related content (same hashtag, similar topics)
- TIME COHERENCE: Group notifications from same time period with shared context

ANTI-FATIGUE FEATURES:
- PATTERN SUPPRESSION: Mute repetitive low-value notifications
- ENGAGEMENT RECIPROCITY: Highlight mutual engagement opportunities
- SOCIAL DEBT TRACKING: Surface comments/messages requiring responses
- OPPORTUNITY DETECTION: Flag potential collaborations, trending participation

ACTIONABLE INTELLIGENCE:
- SUGGESTED RESPONSES: Draft context-appropriate replies for comments
- ENGAGEMENT STRATEGIES: Recommend optimal response timing and approach
- RELATIONSHIP MAINTENANCE: Identify important connections needing attention
- TREND PARTICIPATION: Alert to timely conversation joining opportunities

ATTENTION ECONOMY OPTIMIZATION:
- COGNITIVE LOAD BALANCING: Limit simultaneous decision requirements
- URGENCY CALIBRATION: Prevent false urgency fatigue
- SATISFACTION PREDICTION: Prioritize notifications likely to bring joy
- DISTRACTION MINIMIZATION: Bundle low-priority items into scheduled digests

OUTPUT: JSON with intelligent bundles array, attentionScore (user's current capacity), nextCheckRecommended time, smartInsights for each bundle.`;

    const userPrompt = JSON.stringify({
      notifications: notifications.slice(0, 100),
      userContext: {
        attentionCapacity: this.assessAttentionCapacity(),
        responsePatterns: this.getResponsePatterns(),
        relationshipPriorities: this.getRelationshipPriorities(),
        currentFocus: this.getCurrentFocus(),
        timeAvailable: this.estimateAvailableTime()
      },
      behavioralInsights: {
        notificationPreferences: this.getNotificationPreferences(),
        engagementTiming: this.getOptimalEngagementTimes(),
        socialDebt: this.calculateSocialDebt(),
        interactionValue: this.calculateInteractionValue()
      },
      timestamp: new Date().toISOString()
    });

    return await this.callOpenAI(userPrompt, systemPrompt, 2000);
  }

  // ============ AGENT 6: SAFETY INTELLIGENCE AGENT ============
  async moderateContent(content: { 
    text?: string; 
    url?: string; 
    metadata?: any; 
    context?: string;
    userIntent?: string;
  }): Promise<{
    allowed: boolean;
    issues: string[];
    safeVersion?: string;
    confidence: number;
    recommendations: string[];
    riskAssessment: any;
  }> {
    const systemPrompt = `You are the Safety Intelligence Agent with zero tolerance for harmful content while preserving authentic expression.

MISSION: Protect users and maintain healthy discourse through intelligent content moderation with contextual understanding.

SAFETY CATEGORIES (Strict Enforcement):

HARASSMENT & ABUSE:
- Personal attacks, doxxing, stalking behavior
- Coordinated harassment campaigns
- Targeted abuse based on identity or beliefs
- Cyberbullying and intimidation tactics

HATE SPEECH & DISCRIMINATION:
- Content promoting hatred based on protected characteristics
- Dehumanizing language or imagery
- Supremacist ideologies and symbols
- Discriminatory calls to action

ADULT CONTENT & SAFETY:
- Sexually explicit content in inappropriate contexts
- Non-consensual intimate imagery
- Content harmful to minors
- Exploitation and grooming attempts

MISINFORMATION & FRAUD:
- Health misinformation with potential for harm
- Financial scams and fraudulent schemes
- Election/democratic process manipulation
- Deepfakes and malicious impersonation

VIOLENCE & EXTREMISM:
- Graphic violence and gore
- Terrorist content and recruitment
- Self-harm promotion and instruction
- Dangerous conspiracy theories

INTELLIGENT CONTEXTUAL ANALYSIS:

INTENT ASSESSMENT:
- Educational vs promotional context
- Satire and humor vs genuine harm
- Cultural and linguistic context considerations
- User history and credibility factors

HARM POTENTIAL EVALUATION:
- Immediate vs theoretical harm risk
- Audience vulnerability assessment
- Amplification and virality potential
- Real-world consequence probability

IMPROVEMENT OPPORTUNITIES:
- Constructive alternatives for blocked content
- Educational resources for borderline cases
- Community guideline clarifications
- Platform-specific policy reminders

CONFIDENCE SCORING:
- 0.95-1.0: Clear violation requiring immediate action
- 0.85-0.94: Likely violation, recommend human review
- 0.70-0.84: Borderline case, provide user guidance
- 0.50-0.69: Context-dependent, suggest modifications
- 0.0-0.49: Insufficient information for determination

OUTPUT: JSON with allowed boolean, specific issues array, safe alternative suggestions, confidence score, actionable recommendations, detailed riskAssessment.`;

    const userPrompt = JSON.stringify({
      content: {
        text: content.text?.substring(0, 2000), // Limit for token efficiency
        url: content.url,
        metadata: content.metadata,
        context: content.context || 'general_post',
        userIntent: content.userIntent || 'unknown'
      },
      assessmentContext: {
        platformType: 'social_media',
        audienceType: 'general_public',
        userCredibility: 'standard', // Could be enhanced with actual user scores
        contentHistory: 'positive' // Could be enhanced with actual content history
      },
      moderationStandards: {
        strictness: 'standard',
        culturalContext: 'global',
        ageRating: 'general_audiences'
      },
      timestamp: new Date().toISOString()
    });

    return await this.callOpenAI(userPrompt, systemPrompt, 1000);
  }

  // ============ AGENT 7: SESSION INTELLIGENCE AGENT ============
  async optimizeSession(context: DecisionContext & {
    sessionData: {
      duration: number;
      interactions: number;
      scrollVelocity: number;
      engagementRate: number;
      skipRate: number;
      dwellTime: number;
    };
  }): Promise<{
    recommendedMode: 'quick_hits' | 'deep_dive' | 'discovery' | 'focus' | 'social' | 'learning';
    adaptations: string[];
    contentMix: Record<string, number>;
    nextSessionPredict: string;
    wellnessRecommendations: string[];
    personalizedInsights: any;
  }> {
    const systemPrompt = `You are the Session Intelligence Agent with revolutionary adaptive experience capabilities.

MISSION: Continuously optimize user experience through real-time behavioral analysis and predictive adaptation.

SESSION MODES (Intelligent Selection):

QUICK HITS MODE:
- Short-form content under 30 seconds
- High variety across topics and creators
- Minimal reading requirements
- Instant gratification optimization
- Perfect for: Commuting, waiting, break times

DEEP DIVE MODE:
- Longer content with educational value
- Related content clustering for topic exploration
- Article and video essay prioritization
- Knowledge building progressions
- Perfect for: Learning sessions, research, weekend exploration

DISCOVERY MODE:
- 40% content outside comfort zone
- New creator introduction with soft onboarding
- Emerging trend participation opportunities
- Cross-platform content suggestions
- Perfect for: Expanding horizons, finding new interests

FOCUS MODE:
- Single topic or creator deep exploration
- Distraction elimination and notification pause
- Learning path construction
- Expert content prioritization
- Perfect for: Skill building, research projects

SOCIAL MODE:
- Friend and family content prioritization
- Conversation starter content emphasis
- Reply and comment optimization
- Social debt management assistance
- Perfect for: Maintaining relationships, social engagement

LEARNING MODE:
- Educational content with progressive difficulty
- Skill-building pathway construction
- Industry insight and professional development
- Knowledge retention optimization
- Perfect for: Career growth, hobby mastery

REAL-TIME ADAPTATION TRIGGERS:

ENGAGEMENT PATTERNS:
- High skip rate (>70%) → Increase variety, reset recommendations
- Long dwell time (>2 min/post) → Enable deep content, related suggestions
- Rapid scrolling → Switch to visual content, reduce text density
- High interaction rate → Amplify similar content, encourage engagement

BEHAVIORAL INDICATORS:
- Session length patterns → Predict optimal content pacing
- Time-of-day preferences → Adjust content emotional tone
- Device usage patterns → Optimize for mobile vs desktop experience
- Attention span indicators → Balance cognitive load appropriately

WELLNESS OPTIMIZATION:
- Screen time awareness and break suggestions
- Mood regulation through content emotional tone
- Information overload prevention
- Positive engagement encouragement

PREDICTIVE MODELING:
- Next session timing prediction
- Content preference evolution tracking
- Engagement quality vs quantity optimization
- Long-term satisfaction trajectory analysis

OUTPUT: JSON with recommendedMode, specific adaptations array, optimal contentMix percentages, nextSessionPredict, wellnessRecommendations, personalizedInsights object.`;

    const userPrompt = JSON.stringify({
      sessionData: context.sessionData,
      behaviorHistory: {
        recentSessions: context.behaviorSummary?.recentSessions?.slice(0, 10) || [],
        engagementTrends: context.behaviorSummary?.engagementTrends || {},
        moodPatterns: this.analyzeMoodPatterns(context.behaviorSummary),
        attentionSpanTrends: this.analyzeAttentionSpans(context.behaviorSummary)
      },
      contextualFactors: {
        timeOfDay: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
        deviceType: context.sessionContext?.deviceType || 'mobile',
        locationContext: context.sessionContext?.locationContext || 'unknown',
        socialContext: context.sessionContext?.socialContext || 'alone'
      },
      wellnessMetrics: {
        screenTimeToday: context.sessionContext?.screenTimeToday || 0,
        lastBreakTime: context.sessionContext?.lastBreakTime || 0,
        stressIndicators: this.detectStressIndicators(context.sessionData),
        positivityScore: this.calculatePositivityScore(context.behaviorSummary)
      },
      timestamp: new Date().toISOString()
    });

    return await this.callOpenAI(userPrompt, systemPrompt, 2000);
  }

  // ============ UTILITY METHODS ============
  private inferMoodFromBehavior(behaviorSummary: any): string {
    const engagement = behaviorSummary?.engagementPatterns?.engagementRate || 0;
    const scrollSpeed = behaviorSummary?.scrollBehavior?.scrollSpeed || 'medium';
    const skipRate = behaviorSummary?.engagementPatterns?.skipRate || 0;

    if (engagement > 0.3 && scrollSpeed === 'slow') return 'engaged';
    if (skipRate > 0.7 && scrollSpeed === 'fast') return 'restless';
    if (engagement < 0.1 && scrollSpeed === 'slow') return 'browsing';
    return 'neutral';
  }

  private extractMoodIndicators(behaviorSummary: any): any {
    return {
      energy: this.calculateEnergyLevel(behaviorSummary),
      attention: this.calculateAttentionLevel(behaviorSummary),
      socialDesire: this.calculateSocialDesire(behaviorSummary),
      learningIntent: this.calculateLearningIntent(behaviorSummary)
    };
  }

  private calculateAttentionSpan(behaviorSummary: any): number {
    const avgDwellTime = behaviorSummary?.scrollBehavior?.avgDwellTime || 5000;
    return Math.min(60, Math.max(5, avgDwellTime / 1000)); // 5-60 seconds
  }

  private assessCognitiveLoad(sessionContext: any): number {
    const multitasking = sessionContext?.multitasking || false;
    const distractions = sessionContext?.distractions || 0;
    const timeOfDay = new Date().getHours();
    
    let load = 0.5; // baseline
    if (multitasking) load += 0.2;
    if (distractions > 2) load += 0.3;
    if (timeOfDay < 8 || timeOfDay > 22) load += 0.1; // early morning or late night
    
    return Math.min(1, load);
  }

  private calculateComplexity(post: any): number {
    const textLength = post.text?.length || 0;
    const hasMedia = post.content?.media?.length > 0;
    const linkCount = (post.text?.match(/https?:\/\//g) || []).length;
    
    let complexity = 0;
    if (textLength > 500) complexity += 0.3;
    if (textLength > 1000) complexity += 0.3;
    if (hasMedia) complexity += 0.2;
    if (linkCount > 0) complexity += 0.2;
    
    return complexity;
  }

  private getContentAge(publishedTime: string): number {
    const now = new Date().getTime();
    const published = new Date(publishedTime).getTime();
    return (now - published) / (1000 * 60 * 60); // hours
  }

  private async getCurrentTrends(): Promise<string[]> {
    // In a real implementation, this would fetch from trending APIs
    return ['AI', 'sustainability', 'remote_work', 'mental_health', 'technology'];
  }

  private getSeasonalContext(): string {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
  }

  private getAudienceInsights(behaviorSummary: any): any {
    return {
      primaryDemographic: 'tech_savvy_millennials',
      engagementPeaks: ['9am', '1pm', '7pm'],
      preferredContentTypes: behaviorSummary?.preferredContentTypes || ['video', 'image'],
      responseStyle: 'thoughtful_and_engaging'
    };
  }

  // Additional utility methods for comprehensive behavioral analysis
  private calculateEnergyLevel(behaviorSummary: any): number {
    const scrollSpeed = behaviorSummary?.scrollBehavior?.scrollSpeed || 'medium';
    const interactionRate = behaviorSummary?.engagementPatterns?.engagementRate || 0;
    
    if (scrollSpeed === 'fast' && interactionRate > 0.2) return 0.8;
    if (scrollSpeed === 'slow' && interactionRate < 0.1) return 0.3;
    return 0.5;
  }

  private calculateAttentionLevel(behaviorSummary: any): number {
    const dwellTime = behaviorSummary?.scrollBehavior?.avgDwellTime || 5000;
    return Math.min(1, dwellTime / 30000); // Max at 30 seconds
  }

  private calculateSocialDesire(behaviorSummary: any): number {
    const commentRate = behaviorSummary?.engagementPatterns?.commentRate || 0;
    const shareRate = behaviorSummary?.engagementPatterns?.shareRate || 0;
    return (commentRate * 2 + shareRate) / 3;
  }

  private calculateLearningIntent(behaviorSummary: any): number {
    const saveRate = behaviorSummary?.engagementPatterns?.saveRate || 0;
    const longContentEngagement = behaviorSummary?.contentTypeEngagement?.longform || 0;
    return (saveRate + longContentEngagement) / 2;
  }

  private assessAttentionCapacity(): number {
    const hour = new Date().getHours();
    if (hour >= 9 && hour <= 11) return 0.9; // Morning peak
    if (hour >= 14 && hour <= 16) return 0.8; // Afternoon peak
    if (hour >= 19 && hour <= 21) return 0.7; // Evening
    return 0.5; // Other times
  }

  private getResponsePatterns(): any {
    return {
      avgResponseTime: '2 hours',
      preferredResponseTimes: ['9am', '1pm', '7pm'],
      responseRate: 0.6,
      thoroughnessScore: 0.7
    };
  }

  private getRelationshipPriorities(): any {
    return {
      family: 1.0,
      close_friends: 0.9,
      colleagues: 0.7,
      acquaintances: 0.4,
      public_figures: 0.2
    };
  }

  private getCurrentFocus(): string {
    const hour = new Date().getHours();
    if (hour >= 9 && hour <= 17) return 'work';
    if (hour >= 18 && hour <= 22) return 'personal';
    return 'leisure';
  }

  private estimateAvailableTime(): number {
    // Returns minutes of estimated available time
    const hour = new Date().getHours();
    if (hour >= 9 && hour <= 17) return 5; // Work hours
    if (hour >= 18 && hour <= 22) return 15; // Evening
    return 30; // Other times
  }

  private getNotificationPreferences(): any {
    return {
      maxPerHour: 3,
      mutedTypes: ['promotional', 'algorithmic_suggestions'],
      priorityTypes: ['comments', 'mentions', 'direct_messages'],
      quietHours: { start: 22, end: 8 }
    };
  }

  private getOptimalEngagementTimes(): string[] {
    return ['9:00', '13:00', '19:00']; // Peak engagement times
  }

  private calculateSocialDebt(): number {
    // Returns number of interactions requiring response
    return 3; // Mock value
  }

  private calculateInteractionValue(): number {
    // Returns value score of potential interactions
    return 0.7; // Mock value
  }

  private analyzeMoodPatterns(behaviorSummary: any): any {
    return {
      morningMood: 'energetic',
      afternoonMood: 'focused',
      eveningMood: 'relaxed',
      weekendMood: 'exploratory'
    };
  }

  private analyzeAttentionSpans(behaviorSummary: any): any {
    return {
      shortContent: 15, // seconds
      mediumContent: 45,
      longContent: 180,
      trend: 'stable'
    };
  }

  private detectStressIndicators(sessionData: any): any {
    return {
      rapidScrolling: sessionData.scrollVelocity > 5,
      highSkipRate: sessionData.skipRate > 0.8,
      shortSessions: sessionData.duration < 300,
      lowEngagement: sessionData.engagementRate < 0.05
    };
  }

  private calculatePositivityScore(behaviorSummary: any): number {
    // Analyze content preferences and engagement patterns for positivity
    const positiveTagEngagement = 0.7; // Mock calculation
    const constructiveInteractions = 0.8; // Mock calculation
    return (positiveTagEngagement + constructiveInteractions) / 2;
  }

  // Legacy compatibility methods
  async getRankingAndUIDecisions(request: any): Promise<any> {
    const context: DecisionContext = {
      userId: request.userId,
      behaviorSummary: request.behaviorSummary,
      contentCandidates: request.posts,
      sessionContext: { intent: request.intent, mode: request.sessionMode },
      intent: request.intent
    };

    const [uiDecisions, ranking] = await Promise.all([
      this.generateUIDecisions(context),
      this.rankContent(context)
    ]);

    return {
      rankedPosts: ranking.rankedIds,
      uiDecisions,
      explanations: ranking.explanations,
      sessionInsights: {
        optimization: ranking.sessionOptimization,
        confidence: ranking.confidenceScore,
        adaptiveInsights: ranking.adaptiveInsights
      }
    };
  }
}

export const aiDecisionEngine = new AIDecisionEngine();