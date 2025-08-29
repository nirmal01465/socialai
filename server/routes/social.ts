import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { socialPlatformService } from '../services/socialPlatforms.js';
import { contentNormalizer } from '../services/contentNormalizer.js';
import User from '../models/User.js';

const router = express.Router();

// Get connected platforms status
router.get('/platforms', async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const platformsStatus = user.connectedPlatforms.map(platform => ({
      platform: platform.platform,
      isActive: platform.isActive,
      username: platform.profile.username,
      displayName: platform.profile.displayName,
      connectedAt: platform.connectedAt,
      lastSync: platform.lastSync
    }));

    // Check API health for each platform
    const healthChecks = await Promise.allSettled(
      platformsStatus.map(async platform => {
        try {
          const isHealthy = await socialPlatformService.checkPlatformHealth(
            platform.platform,
            user.connectedPlatforms.find(p => p.platform === platform.platform)?.accessToken
          );
          return { platform: platform.platform, healthy: isHealthy };
        } catch (error) {
          return { platform: platform.platform, healthy: false };
        }
      })
    );

    const healthStatus = healthChecks.map(result => 
      result.status === 'fulfilled' ? result.value : { platform: 'unknown', healthy: false }
    );

    res.json({
      platforms: platformsStatus,
      health: healthStatus,
      totalConnected: platformsStatus.filter(p => p.isActive).length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Platforms status error:', error);
    res.status(500).json({ error: 'Failed to fetch platforms status' });
  }
});

// Sync content from specific platform
router.post('/sync/:platform', async (req, res) => {
  try {
    const { platform } = req.params;
    const userId = req.user.userId;

    if (!['instagram', 'youtube', 'twitter', 'facebook'].includes(platform)) {
      return res.status(400).json({ error: 'Unsupported platform' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const platformConnection = user.connectedPlatforms.find(p => p.platform === platform);
    if (!platformConnection || !platformConnection.isActive) {
      return res.status(400).json({ error: `${platform} not connected or inactive` });
    }

    // Fetch latest content
    const rawPosts = await socialPlatformService.fetchFeed(
      platform,
      platformConnection.accessToken,
      { limit: 50, includeMetadata: true }
    );

    // Normalize posts
    const normalizedPosts = rawPosts.map(post => 
      contentNormalizer.normalizePost(post, platform)
    );

    // Update last sync time
    platformConnection.lastSync = new Date();
    await user.save();

    res.json({
      platform,
      syncedPosts: normalizedPosts.length,
      posts: normalizedPosts.slice(0, 10), // Return first 10 for preview
      lastSync: platformConnection.lastSync,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Platform sync error:', error);
    res.status(500).json({ error: `Failed to sync ${req.params.platform}` });
  }
});

// Post content to platform
router.post('/post/:platform', [
  body('content').notEmpty().isLength({ min: 1, max: 2000 }),
  body('mediaUrls').optional().isArray(),
  body('hashtags').optional().isArray(),
  body('location').optional().isObject(),
  body('scheduleAt').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { platform } = req.params;
    const { content, mediaUrls = [], hashtags = [], location, scheduleAt } = req.body;
    const userId = req.user.userId;

    if (!['instagram', 'youtube', 'twitter', 'facebook'].includes(platform)) {
      return res.status(400).json({ error: 'Unsupported platform' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const platformConnection = user.connectedPlatforms.find(p => p.platform === platform);
    if (!platformConnection || !platformConnection.isActive) {
      return res.status(400).json({ error: `${platform} not connected or inactive` });
    }

    // Format content for specific platform
    const formattedContent = contentNormalizer.formatForPlatform({
      content,
      hashtags,
      platform
    });

    // Post to platform
    const postResult = await socialPlatformService.createPost(
      platform,
      platformConnection.accessToken,
      {
        content: formattedContent,
        mediaUrls,
        location,
        scheduleAt: scheduleAt ? new Date(scheduleAt) : undefined
      }
    );

    res.json({
      success: true,
      platform,
      postId: postResult.id,
      url: postResult.url,
      scheduledFor: scheduleAt,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Post creation error:', error);
    res.status(500).json({ error: `Failed to post to ${req.params.platform}` });
  }
});

// Get platform-specific analytics
router.get('/analytics/:platform', [
  query('timeframe').optional().isIn(['7d', '30d', '90d']),
  query('metrics').optional().isString()
], async (req, res) => {
  try {
    const { platform } = req.params;
    const timeframe = req.query.timeframe as string || '30d';
    const metrics = req.query.metrics ? (req.query.metrics as string).split(',') : ['engagement', 'reach', 'impressions'];
    const userId = req.user.userId;

    if (!['instagram', 'youtube', 'twitter', 'facebook'].includes(platform)) {
      return res.status(400).json({ error: 'Unsupported platform' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const platformConnection = user.connectedPlatforms.find(p => p.platform === platform);
    if (!platformConnection || !platformConnection.isActive) {
      return res.status(400).json({ error: `${platform} not connected or inactive` });
    }

    // Fetch analytics from platform
    const analytics = await socialPlatformService.getAnalytics(
      platform,
      platformConnection.accessToken,
      {
        timeframe,
        metrics
      }
    );

    res.json({
      platform,
      timeframe,
      analytics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: `Failed to fetch ${req.params.platform} analytics` });
  }
});

// Search content on platform
router.get('/search/:platform', [
  query('q').notEmpty().isLength({ min: 1, max: 200 }),
  query('type').optional().isIn(['posts', 'users', 'hashtags']),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { platform } = req.params;
    const { q: query, type = 'posts', limit = 20 } = req.query;
    const userId = req.user.userId;

    if (!['instagram', 'youtube', 'twitter', 'facebook'].includes(platform)) {
      return res.status(400).json({ error: 'Unsupported platform' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const platformConnection = user.connectedPlatforms.find(p => p.platform === platform);
    if (!platformConnection || !platformConnection.isActive) {
      return res.status(400).json({ error: `${platform} not connected or inactive` });
    }

    // Search on platform
    const searchResults = await socialPlatformService.searchContent(
      platform,
      platformConnection.accessToken,
      {
        query: query as string,
        type: type as string,
        limit: parseInt(limit as string)
      }
    );

    // Normalize search results
    const normalizedResults = searchResults.map(result => 
      contentNormalizer.normalizePost(result, platform)
    );

    res.json({
      platform,
      query,
      type,
      results: normalizedResults,
      totalFound: searchResults.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Platform search error:', error);
    res.status(500).json({ error: `Failed to search on ${req.params.platform}` });
  }
});

// Get trending hashtags for platform
router.get('/trending/:platform', [
  query('location').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt()
], async (req, res) => {
  try {
    const { platform } = req.params;
    const { location, limit = 20 } = req.query;
    const userId = req.user.userId;

    if (!['instagram', 'youtube', 'twitter', 'facebook'].includes(platform)) {
      return res.status(400).json({ error: 'Unsupported platform' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const platformConnection = user.connectedPlatforms.find(p => p.platform === platform);
    if (!platformConnection || !platformConnection.isActive) {
      return res.status(400).json({ error: `${platform} not connected or inactive` });
    }

    // Get trending content from platform
    const trending = await socialPlatformService.getTrending(
      platform,
      platformConnection.accessToken,
      {
        location: location as string,
        limit: parseInt(limit as string)
      }
    );

    res.json({
      platform,
      location,
      trending,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Trending error:', error);
    res.status(500).json({ error: `Failed to fetch trending content from ${req.params.platform}` });
  }
});

// Cross-post content to multiple platforms
router.post('/cross-post', [
  body('content').notEmpty().isLength({ min: 1, max: 2000 }),
  body('platforms').isArray({ min: 1 }),
  body('adaptContent').optional().isBoolean(),
  body('mediaUrls').optional().isArray(),
  body('hashtags').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { content, platforms, adaptContent = true, mediaUrls = [], hashtags = [] } = req.body;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const results = [];

    for (const platform of platforms) {
      try {
        const platformConnection = user.connectedPlatforms.find(p => p.platform === platform);
        if (!platformConnection || !platformConnection.isActive) {
          results.push({
            platform,
            success: false,
            error: 'Platform not connected or inactive'
          });
          continue;
        }

        // Adapt content for each platform if requested
        const platformContent = adaptContent 
          ? contentNormalizer.formatForPlatform({ content, hashtags, platform })
          : content;

        const postResult = await socialPlatformService.createPost(
          platform,
          platformConnection.accessToken,
          {
            content: platformContent,
            mediaUrls
          }
        );

        results.push({
          platform,
          success: true,
          postId: postResult.id,
          url: postResult.url
        });

      } catch (error) {
        results.push({
          platform,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    res.json({
      crossPostResults: results,
      totalPlatforms: platforms.length,
      successfulPosts: successCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cross-post error:', error);
    res.status(500).json({ error: 'Failed to cross-post content' });
  }
});

export default router;
