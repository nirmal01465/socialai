import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { aiDecisionEngine } from '../services/aiDecisionEngine.js';
import { socialPlatformService } from '../services/socialPlatforms.js';
import { contentNormalizer } from '../services/contentNormalizer.js';
import { behaviorAnalytics } from '../services/behaviorAnalytics.js';
import User from '../models/User.js';
import Post from '../models/Post.js';
import BehaviorEvent from '../models/BehaviorEvent.js';
import { getRedisClient } from '../database/redis.js';

const router = express.Router();

// Get unified feed with AI-powered ranking
router.get('/', [
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt(),
  query('intent').optional().isString(),
  query('mode').optional().isIn(['quick_hits', 'deep_dive', 'only_friends', 'learning'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.userId;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = parseInt(req.query.offset as string) || 0;
    const intent = req.query.intent as string || 'default_scroll';
    const mode = req.query.mode as string || 'default';

    // Get user and behavior summary
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check cache first
    const redis = getRedisClient();
    const cacheKey = `feed:${userId}:${limit}:${offset}:${intent}:${mode}`;
    const cachedFeed = await redis.get(cacheKey);
    
    if (cachedFeed) {
      return res.json({
        posts: JSON.parse(cachedFeed),
        cached: true,
        timestamp: new Date().toISOString()
      });
    }

    // Fetch content from connected platforms
    const allPosts = [];
    for (const platform of user.connectedPlatforms) {
      if (platform.isActive) {
        try {
          const platformPosts = await socialPlatformService.fetchFeed(
            platform.platform,
            platform.accessToken,
            { limit: Math.ceil(limit * 1.5) } // Fetch more for better ranking
          );
          
          const normalizedPosts = platformPosts.map(post => 
            contentNormalizer.normalizePost(post, platform.platform)
          );
          
          allPosts.push(...normalizedPosts);
        } catch (error) {
          console.error(`Error fetching from ${platform.platform}:`, error);
        }
      }
    }

    if (allPosts.length === 0) {
      return res.json({
        posts: [],
        message: 'No content available. Please connect social media accounts.',
        timestamp: new Date().toISOString()
      });
    }

    // Apply heuristic pre-filtering
    const preFilteredPosts = allPosts
      .filter(post => post.text && post.text.length > 0) // Remove empty posts
      .filter(post => !post.tags?.some(tag => 
        ['spam', 'nsfw', 'hate'].includes(tag.toLowerCase())
      )) // Basic safety filter
      .sort((a, b) => new Date(b.timePublished).getTime() - new Date(a.timePublished).getTime()) // Sort by recency
      .slice(0, 100); // Limit for AI processing

    // Get AI-powered ranking and UI decisions
    const behaviorSummary = await behaviorAnalytics.generateSummary(userId);
    const aiDecisions = await aiDecisionEngine.getRankingAndUIDecisions({
      userId,
      behaviorSummary,
      posts: preFilteredPosts,
      intent,
      sessionMode: mode
    });

    // Apply AI ranking
    const rankedPosts = aiDecisions.rankedPosts.slice(offset, offset + limit);

    // Store posts in database for future reference
    for (const post of rankedPosts) {
      await Post.findOneAndUpdate(
        { id: post.id },
        { 
          ...post,
          lastSeen: new Date(),
          seenByUsers: userId
        },
        { upsert: true, new: true }
      );
    }

    // Cache the result
    await redis.setex(cacheKey, 300, JSON.stringify(rankedPosts)); // 5 min cache

    res.json({
      posts: rankedPosts,
      uiDecisions: aiDecisions.uiDecisions,
      explanations: aiDecisions.explanations,
      sessionInsights: aiDecisions.sessionInsights,
      timestamp: new Date().toISOString(),
      totalAvailable: preFilteredPosts.length
    });

  } catch (error) {
    console.error('Feed error:', error);
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

// Record behavior event
router.post('/behavior', [
  body('events').isArray({ min: 1 }),
  body('events.*.postId').notEmpty(),
  body('events.*.type').isIn(['view', 'like', 'skip', 'comment', 'share', 'save', 'click']),
  body('events.*.timestamp').isISO8601(),
  body('events.*.dwellTime').optional().isInt({ min: 0 }),
  body('events.*.metadata').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.userId;
    const { events } = req.body;

    // Store behavior events
    const behaviorEvents = events.map((event: any) => ({
      userId,
      postId: event.postId,
      eventType: event.type,
      timestamp: new Date(event.timestamp),
      dwellTime: event.dwellTime,
      metadata: event.metadata || {},
      sessionId: req.headers['x-session-id'] || 'unknown'
    }));

    await BehaviorEvent.insertMany(behaviorEvents);

    // Update user behavior summary asynchronously
    behaviorAnalytics.updateUserSummary(userId, events).catch(error => {
      console.error('Error updating behavior summary:', error);
    });

    res.json({ 
      message: 'Behavior events recorded',
      eventsProcessed: events.length
    });

  } catch (error) {
    console.error('Behavior tracking error:', error);
    res.status(500).json({ error: 'Failed to record behavior events' });
  }
});

// Get trending content
router.get('/trending', [
  query('timeframe').optional().isIn(['1h', '6h', '24h', '7d']),
  query('platform').optional().isIn(['instagram', 'youtube', 'twitter', 'facebook', 'all']),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const timeframe = req.query.timeframe as string || '24h';
    const platform = req.query.platform as string || 'all';
    const limit = parseInt(req.query.limit as string) || 20;

    // Calculate time threshold
    const now = new Date();
    const timeThresholds: { [key: string]: number } = {
      '1h': 1 * 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };
    
    const threshold = new Date(now.getTime() - timeThresholds[timeframe]);

    // Build query
    const query: any = {
      timePublished: { $gte: threshold }
    };

    if (platform !== 'all') {
      query.platform = platform;
    }

    // Get trending posts based on engagement
    const trendingPosts = await Post.aggregate([
      { $match: query },
      {
        $addFields: {
          engagementScore: {
            $add: [
              { $multiply: ['$stats.likes', 1] },
              { $multiply: ['$stats.comments', 3] },
              { $multiply: ['$stats.shares', 5] }
            ]
          }
        }
      },
      { $sort: { engagementScore: -1 } },
      { $limit: limit }
    ]);

    res.json({
      trending: trendingPosts,
      timeframe,
      platform,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Trending feed error:', error);
    res.status(500).json({ error: 'Failed to fetch trending content' });
  }
});

// Search content
router.get('/search', [
  query('q').notEmpty().isLength({ min: 1, max: 200 }),
  query('platforms').optional().isString(),
  query('contentType').optional().isIn(['all', 'short', 'longform', 'image', 'thread']),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const query = req.query.q as string;
    const platforms = req.query.platforms ? (req.query.platforms as string).split(',') : [];
    const contentType = req.query.contentType as string || 'all';
    const limit = parseInt(req.query.limit as string) || 25;

    // Build search query
    const searchQuery: any = {
      $or: [
        { text: { $regex: query, $options: 'i' } },
        { 'creator.displayName': { $regex: query, $options: 'i' } },
        { tags: { $in: [new RegExp(query, 'i')] } }
      ]
    };

    if (platforms.length > 0) {
      searchQuery.platform = { $in: platforms };
    }

    if (contentType !== 'all') {
      searchQuery.type = contentType;
    }

    const searchResults = await Post.find(searchQuery)
      .sort({ timePublished: -1 })
      .limit(limit);

    // Get AI-enhanced search results
    const userId = req.user.userId;
    const behaviorSummary = await behaviorAnalytics.generateSummary(userId);
    
    const enhancedResults = await aiDecisionEngine.enhanceSearchResults({
      userId,
      query,
      results: searchResults,
      behaviorSummary
    });

    res.json({
      results: enhancedResults,
      query,
      totalFound: searchResults.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get post details with AI analysis
router.get('/post/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.userId;

    const post = await Post.findOne({ id: postId });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Get AI analysis of the post
    const analysis = await aiDecisionEngine.analyzePost({
      post,
      userId,
      includeExplanation: true
    });

    res.json({
      post,
      analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Post details error:', error);
    res.status(500).json({ error: 'Failed to fetch post details' });
  }
});

export default router;
