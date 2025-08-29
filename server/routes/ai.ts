import express from 'express';
import { body, validationResult } from 'express-validator';
import { aiDecisionEngine } from '../services/aiDecisionEngine.js';
import { behaviorAnalytics } from '../services/behaviorAnalytics.js';
import { openaiService } from '../services/openai.js';
import User from '../models/User.js';
import Post from '../models/Post.js';

const router = express.Router();

// Process natural language command
router.post('/command', [
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

    // Get user behavior summary for context
    const behaviorSummary = await behaviorAnalytics.generateSummary(userId);
    const user = await User.findById(userId).select('-password');

    // Process command with AI
    const commandResult = await aiDecisionEngine.processCommand({
      userId,
      command,
      context,
      behaviorSummary,
      userProfile: user
    });

    res.json({
      success: true,
      result: commandResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('AI command error:', error);
    res.status(500).json({ error: 'Failed to process command' });
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

// Get UI layout decisions
router.post('/ui-decisions', [
  body('sessionData').optional().isObject(),
  body('currentLayout').optional().isObject()
], async (req, res) => {
  try {
    const { sessionData = {}, currentLayout = {} } = req.body;
    const userId = req.user.userId;

    // Get recent behavior data
    const behaviorSummary = await behaviorAnalytics.generateSummary(userId);
    
    // Get AI-powered UI decisions
    const uiDecisions = await aiDecisionEngine.getUIDecisions({
      userId,
      behaviorSummary,
      sessionData,
      currentLayout
    });

    res.json({
      uiDecisions,
      reasoning: uiDecisions.reasoning,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('UI decisions error:', error);
    res.status(500).json({ error: 'Failed to generate UI decisions' });
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
