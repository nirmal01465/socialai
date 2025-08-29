import express from 'express';
import { body, validationResult } from 'express-validator';
import { aiDecisionEngine } from '../services/aiDecisionEngine.js';
import { behaviorAnalytics } from '../services/behaviorAnalytics.js';
import { openaiService } from '../services/openai.js';
import User from '../models/User.js';
import Post from '../models/Post.js';

const router = express.Router();

// Process natural language command (Revolutionary Command Intelligence Agent)
router.post('/commands', [
  body('command').notEmpty().isLength({ min: 1, max: 500 }),
  body('context').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { command, context = {} } = req.body;
    const userId = req.user.userId;

    // Get comprehensive context for AI command processing
    const behaviorSummary = await behaviorAnalytics.generateSummary(userId);
    const user = await User.findById(userId).select('-password');

    // Process with Revolutionary Command Intelligence Agent
    const result = await aiDecisionEngine.processCommand({
      userId,
      command,
      context: {
        ...context,
        behaviorSummary,
        userProfile: user,
        sessionContext: context.sessionContext || {}
      }
    });

    res.json({
      success: result.success,
      action: result.action,
      parameters: result.parameters,
      explanation: result.explanation,
      suggestions: result.suggestions,
      confidence: result.confidence,
      executionPlan: result.executionPlan,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Revolutionary AI command error:', error);
    res.status(500).json({
      success: false,
      error: 'AI command processing failed',
      suggestions: [
        'Try rephrasing your command',
        'Use simpler language',
        'Check your connection and try again'
      ]
    });
  }
});

// Revolutionary Command Suggestions
router.post('/suggestions', [
  body('input').notEmpty().isLength({ min: 1, max: 200 }),
  body('context').optional().isObject()
], async (req, res) => {
  try {
    const { input, context = {} } = req.body;
    const userId = req.user.userId;

    const behaviorSummary = await behaviorAnalytics.generateSummary(userId);
    
    // Generate intelligent suggestions using AI
    const suggestions = await aiDecisionEngine.processCommand({
      userId,
      command: `Generate command suggestions for input: "${input}"`,
      context: {
        type: 'suggestion_generation',
        input,
        behaviorSummary,
        ...context
      }
    });

    res.json({
      suggestions: suggestions.suggestions || [],
      confidence: suggestions.confidence || 0.8,
      context: input,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Suggestions generation error:', error);
    res.json({
      suggestions: [
        { id: 'fallback-1', text: 'Show trending posts', category: 'search', confidence: 0.7 },
        { id: 'fallback-2', text: 'Filter by topic', category: 'filter', confidence: 0.7 },
        { id: 'fallback-3', text: 'Switch to focus mode', category: 'session', confidence: 0.7 }
      ],
      confidence: 0.6,
      fallback: true
    });
  }
});

// Generate content suggestions
router.post('/suggest-content', [
  body('type').isIn(['caption', 'reply', 'hashtags', 'cross_post']),
  body('input').notEmpty().isString(),
  body('platform').optional().isIn(['instagram', 'youtube', 'twitter', 'facebook']),
  body('tone').optional().isIn(['professional', 'casual', 'witty', 'brand', 'authentic'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { type, input, platform, tone = 'authentic' } = req.body;
    const userId = req.user.userId;

    // Get user's brand voice profile
    const user = await User.findById(userId);
    const behaviorSummary = await behaviorAnalytics.generateSummary(userId);

    const suggestions = await aiDecisionEngine.generateContentSuggestions({
      userId,
      type,
      input,
      platform,
      tone,
      userProfile: user,
      behaviorSummary
    });

    res.json({
      suggestions,
      type,
      platform,
      tone,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Content suggestion error:', error);
    res.status(500).json({ error: 'Failed to generate content suggestions' });
  }
});

// Revolutionary UI Intelligence Agent
router.post('/ui-decisions', [
  body('behaviorSummary').optional().isObject(),
  body('sessionContext').optional().isObject()
], async (req, res) => {
  try {
    const { behaviorSummary: providedSummary, sessionContext = {} } = req.body;
    const userId = req.user.userId;

    // Use provided summary or generate fresh one
    const behaviorSummary = providedSummary || await behaviorAnalytics.generateSummary(userId);
    
    // Revolutionary UI Intelligence Agent
    const uiDecisions = await aiDecisionEngine.generateUIDecisions({
      userId,
      behaviorSummary,
      sessionContext: {
        ...sessionContext,
        timestamp: new Date().toISOString()
      }
    });

    res.json({
      ...uiDecisions,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Revolutionary UI decisions error:', error);
    res.status(500).json({
      error: 'UI intelligence temporarily unavailable',
      fallback: {
        version: "1.0",
        layout: {
          sections: [{ id: "unified_feed", priority: 0, visible: true }],
          feedColumns: 1,
          cardStyle: "detailed",
          showSidebar: false,
          adaptiveFeatures: { autoSummary: true, contextualSuggestions: true, smartNotifications: true, realTimeAdaptation: true }
        },
        featureFlags: { commandBar: true, whyThisPost: true },
        feedRules: { blocklist: [], boostTags: ["trending"], preferredContentTypes: ["video"], diversityWeight: 0.7, moodOptimization: true }
      }
    });
  }
});

// Behavior Summary for AI Intelligence
router.post('/behavior-summary', [
  body('summary').isObject(),
  body('sessionContext').optional().isObject()
], async (req, res) => {
  try {
    const { summary, sessionContext = {} } = req.body;
    const userId = req.user.userId;

    // Store behavior summary for AI processing
    await behaviorAnalytics.processSummary(userId, summary, sessionContext);

    // Trigger real-time AI adaptations if significant changes detected
    const adaptationTrigger = await aiDecisionEngine.optimizeSession({
      userId,
      behaviorSummary: summary,
      sessionContext,
      sessionData: {
        duration: sessionContext.duration || 0,
        interactions: sessionContext.interactions || 0,
        scrollVelocity: sessionContext.scrollVelocity || 0,
        engagementRate: sessionContext.engagementRate || 0,
        skipRate: sessionContext.skipRate || 0,
        dwellTime: sessionContext.dwellTime || 0
      }
    });

    res.json({
      success: true,
      adaptations: adaptationTrigger,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Behavior summary processing error:', error);
    res.status(500).json({ error: 'Failed to process behavior summary' });
  }
});

// Session Mode Intelligence
router.post('/session-mode', [
  body('mode').isIn(['quick_hits', 'deep_dive', 'discovery', 'focus', 'social', 'learning']),
  body('duration').optional().isInt({ min: 0 }),
  body('trigger').optional().isString()
], async (req, res) => {
  try {
    const { mode, duration, trigger = 'user_selection' } = req.body;
    const userId = req.user.userId;

    const behaviorSummary = await behaviorAnalytics.generateSummary(userId);

    // Optimize session with AI
    const sessionOptimization = await aiDecisionEngine.optimizeSession({
      userId,
      behaviorSummary,
      sessionContext: { requestedMode: mode, trigger },
      sessionData: {
        duration: 0,
        interactions: 0,
        scrollVelocity: 0,
        engagementRate: 0,
        skipRate: 0,
        dwellTime: 0
      }
    });

    res.json({
      success: true,
      mode,
      optimization: sessionOptimization,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Session mode optimization error:', error);
    res.status(500).json({ error: 'Failed to optimize session mode' });
  }
});

// Analyze post engagement potential
router.post('/analyze-engagement', [
  body('postContent').notEmpty().isString(),
  body('platform').isIn(['instagram', 'youtube', 'twitter', 'facebook']),
  body('metadata').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { postContent, platform, metadata = {} } = req.body;
    const userId = req.user.userId;

    const analysis = await aiDecisionEngine.analyzeEngagementPotential({
      userId,
      content: postContent,
      platform,
      metadata
    });

    res.json({
      analysis,
      recommendations: analysis.recommendations,
      score: analysis.engagementScore,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Engagement analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze engagement potential' });
  }
});

// Get personalized notifications
router.get('/notifications', async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user behavior and preferences
    const user = await User.findById(userId);
    const behaviorSummary = await behaviorAnalytics.generateSummary(userId);

    // Generate intelligent notification bundles
    const notifications = await aiDecisionEngine.generateSmartNotifications({
      userId,
      userProfile: user,
      behaviorSummary
    });

    res.json({
      notifications,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Smart notifications error:', error);
    res.status(500).json({ error: 'Failed to generate notifications' });
  }
});

// Explain recommendation
router.post('/explain', [
  body('postId').notEmpty().isString(),
  body('action').isIn(['recommended', 'ranked_high', 'filtered_out', 'promoted'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { postId, action } = req.body;
    const userId = req.user.userId;

    // Get post details
    const post = await Post.findOne({ id: postId });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Generate explanation
    const explanation = await aiDecisionEngine.explainDecision({
      userId,
      post,
      action,
      includePersonalization: true
    });

    res.json({
      explanation,
      postId,
      action,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Explanation error:', error);
    res.status(500).json({ error: 'Failed to generate explanation' });
  }
});

// Generate mood-based content filter
router.post('/mood-filter', [
  body('currentMood').optional().isIn(['energetic', 'calm', 'focused', 'social', 'creative']),
  body('timeAvailable').optional().isIn(['quick', 'moderate', 'extended']),
  body('contentGoal').optional().isIn(['entertainment', 'learning', 'inspiration', 'news'])
], async (req, res) => {
  try {
    const { currentMood, timeAvailable, contentGoal } = req.body;
    const userId = req.user.userId;

    // Get user behavior patterns
    const behaviorSummary = await behaviorAnalytics.generateSummary(userId);

    // Generate mood-based content recommendations
    const moodFilter = await aiDecisionEngine.generateMoodBasedFilter({
      userId,
      currentMood,
      timeAvailable,
      contentGoal,
      behaviorSummary
    });

    res.json({
      filter: moodFilter,
      appliedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Mood filter error:', error);
    res.status(500).json({ error: 'Failed to generate mood-based filter' });
  }
});

// Sentiment analysis for content
router.post('/sentiment', [
  body('text').notEmpty().isLength({ min: 1, max: 5000 }),
  body('includeEmotions').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { text, includeEmotions = false } = req.body;

    const sentimentAnalysis = await openaiService.analyzeSentiment(text);
    
    let emotionAnalysis = null;
    if (includeEmotions) {
      emotionAnalysis = await openaiService.analyzeEmotions(text);
    }

    res.json({
      sentiment: sentimentAnalysis,
      emotions: emotionAnalysis,
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Sentiment analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze sentiment' });
  }
});

// Generate content summary
router.post('/summarize', [
  body('content').notEmpty().isLength({ min: 50, max: 10000 }),
  body('summaryType').optional().isIn(['brief', 'detailed', 'key_points']),
  body('maxLength').optional().isInt({ min: 50, max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { content, summaryType = 'brief', maxLength = 150 } = req.body;

    const summary = await openaiService.generateSummary({
      content,
      type: summaryType,
      maxLength
    });

    res.json({
      summary,
      originalLength: content.length,
      summaryLength: summary.length,
      compressionRatio: (summary.length / content.length * 100).toFixed(1) + '%',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Summarization error:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

export default router;
