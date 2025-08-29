interface RawPost {
  id?: string;
  caption?: string;
  message?: string;
  text?: string;
  title?: string;
  description?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  url?: string;
  created_time?: string;
  timestamp?: string;
  published_at?: string;
  like_count?: number;
  likes?: { summary?: { total_count?: number } };
  comments_count?: number;
  comments?: { summary?: { total_count?: number } };
  shares?: number;
  views?: number;
  author?: any;
  user?: any;
  channel?: any;
  snippet?: any;
  statistics?: any;
  media_type?: string;
  type?: string;
  duration?: number;
  tags?: string[];
  hashtags?: string[];
}

interface NormalizedPost {
  id: string;
  platform: string;
  url: string;
  type: 'short' | 'longform' | 'image' | 'thread' | 'live';
  creator: {
    handle: string;
    id: string;
    displayName: string;
    profilePicture?: string;
  };
  text: string;
  tags: string[];
  durationS?: number;
  stats: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
  };
  timePublished: string;
  thumbnail?: string;
  mediaUrl?: string;
  metadata?: any;
}

interface ContentFormatOptions {
  content: string;
  hashtags?: string[];
  platform: string;
  maxLength?: number;
}

class ContentNormalizerService {
  
  // Normalize post data from different platforms to unified schema
  normalizePost(rawPost: RawPost, platform: string): NormalizedPost {
    try {
      switch (platform) {
        case 'instagram':
          return this.normalizeInstagramPost(rawPost);
        case 'youtube':
          return this.normalizeYouTubePost(rawPost);
        case 'twitter':
          return this.normalizeTwitterPost(rawPost);
        case 'facebook':
          return this.normalizeFacebookPost(rawPost);
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }
    } catch (error) {
      console.error(`Error normalizing ${platform} post:`, error);
      return this.createFallbackPost(rawPost, platform);
    }
  }

  // Normalize Instagram post
  private normalizeInstagramPost(post: RawPost): NormalizedPost {
    const id = post.id || `ig_${Date.now()}`;
    const text = post.caption || '';
    const mediaType = post.media_type?.toLowerCase();
    
    // Determine content type based on media and duration
    let type: NormalizedPost['type'] = 'image';
    if (mediaType === 'video') {
      type = (post.duration && post.duration < 60) ? 'short' : 'longform';
    }

    // Extract hashtags from caption
    const hashtags = this.extractHashtags(text);
    
    return {
      id,
      platform: 'instagram',
      url: post.permalink || `https://instagram.com/p/${id}`,
      type,
      creator: {
        handle: '@unknown',
        id: 'unknown',
        displayName: 'Instagram User'
      },
      text: this.cleanText(text),
      tags: hashtags,
      durationS: post.duration,
      stats: {
        likes: post.like_count || 0,
        comments: post.comments_count || 0,
        shares: 0, // Instagram doesn't provide share count
        views: 0
      },
      timePublished: post.timestamp || new Date().toISOString(),
      thumbnail: post.media_url,
      mediaUrl: post.media_url
    };
  }

  // Normalize YouTube post
  private normalizeYouTubePost(post: RawPost): NormalizedPost {
    const id = post.id || `yt_${Date.now()}`;
    const snippet = post.snippet || {};
    const statistics = post.statistics || {};
    
    // Determine type based on duration or category
    const duration = this.parseDuration(snippet.duration);
    let type: NormalizedPost['type'] = 'longform';
    if (duration && duration < 60) {
      type = 'short';
    }

    return {
      id,
      platform: 'youtube',
      url: `https://youtu.be/${id}`,
      type,
      creator: {
        handle: snippet.channelTitle || '@unknown',
        id: snippet.channelId || 'unknown',
        displayName: snippet.channelTitle || 'YouTube Creator'
      },
      text: this.cleanText(snippet.title + '\n\n' + (snippet.description || '')),
      tags: snippet.tags || this.extractKeywords(snippet.title + ' ' + snippet.description),
      durationS: duration,
      stats: {
        likes: parseInt(statistics.likeCount) || 0,
        comments: parseInt(statistics.commentCount) || 0,
        shares: 0,
        views: parseInt(statistics.viewCount) || 0
      },
      timePublished: snippet.publishedAt || new Date().toISOString(),
      thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url
    };
  }

  // Normalize Twitter post
  private normalizeTwitterPost(post: RawPost): NormalizedPost {
    const id = post.id || `tw_${Date.now()}`;
    const text = post.text || '';
    const publicMetrics = post.public_metrics || {};
    
    // Determine if it's a thread based on text length or reply structure
    const type: NormalizedPost['type'] = text.length > 240 ? 'thread' : 'short';

    return {
      id,
      platform: 'twitter',
      url: `https://twitter.com/user/status/${id}`,
      type,
      creator: {
        handle: post.author?.username ? `@${post.author.username}` : '@unknown',
        id: post.author?.id || 'unknown',
        displayName: post.author?.name || 'Twitter User',
        profilePicture: post.author?.profile_image_url
      },
      text: this.cleanText(text),
      tags: this.extractHashtags(text).concat(this.extractMentions(text)),
      stats: {
        likes: publicMetrics.like_count || 0,
        comments: publicMetrics.reply_count || 0,
        shares: publicMetrics.retweet_count || 0,
        views: publicMetrics.impression_count || 0
      },
      timePublished: post.created_at || new Date().toISOString(),
      thumbnail: post.attachments?.media?.[0]?.preview_image_url
    };
  }

  // Normalize Facebook post
  private normalizeFacebookPost(post: RawPost): NormalizedPost {
    const id = post.id || `fb_${Date.now()}`;
    const text = post.message || '';
    const likesCount = post.likes?.summary?.total_count || 0;
    const commentsCount = post.comments?.summary?.total_count || 0;

    return {
      id,
      platform: 'facebook',
      url: `https://facebook.com/posts/${id}`,
      type: 'longform', // Facebook posts are typically longer form
      creator: {
        handle: '@facebook_user',
        id: 'unknown',
        displayName: 'Facebook User'
      },
      text: this.cleanText(text),
      tags: this.extractHashtags(text),
      stats: {
        likes: likesCount,
        comments: commentsCount,
        shares: post.shares || 0,
        views: 0
      },
      timePublished: post.created_time || new Date().toISOString(),
      thumbnail: post.thumbnail_url
    };
  }

  // Format content for specific platform
  formatForPlatform(options: ContentFormatOptions): string {
    const { content, hashtags = [], platform, maxLength } = options;
    
    try {
      switch (platform) {
        case 'instagram':
          return this.formatForInstagram(content, hashtags, maxLength);
        case 'youtube':
          return this.formatForYouTube(content, hashtags, maxLength);
        case 'twitter':
          return this.formatForTwitter(content, hashtags, maxLength);
        case 'facebook':
          return this.formatForFacebook(content, hashtags, maxLength);
        default:
          return content;
      }
    } catch (error) {
      console.error(`Error formatting for ${platform}:`, error);
      return content;
    }
  }

  // Format for Instagram (visual-focused, hashtags)
  private formatForInstagram(content: string, hashtags: string[], maxLength = 2200): string {
    let formatted = content;
    
    // Add line breaks for readability
    if (!formatted.includes('\n') && formatted.length > 100) {
      formatted = this.addLineBreaks(formatted);
    }
    
    // Add hashtags at the end
    if (hashtags.length > 0) {
      const hashtagString = '\n\n' + hashtags.map(tag => `#${tag.replace('#', '')}`).join(' ');
      formatted += hashtagString;
    }
    
    return this.truncateText(formatted, maxLength);
  }

  // Format for YouTube (SEO-friendly, descriptive)
  private formatForYouTube(content: string, hashtags: string[], maxLength = 5000): string {
    let formatted = content;
    
    // Ensure title-like format for first line
    const lines = formatted.split('\n');
    if (lines.length > 0) {
      lines[0] = this.toTitleCase(lines[0]);
      formatted = lines.join('\n');
    }
    
    // Add hashtags in description
    if (hashtags.length > 0) {
      const hashtagString = '\n\nTags: ' + hashtags.map(tag => `#${tag.replace('#', '')}`).join(' ');
      formatted += hashtagString;
    }
    
    return this.truncateText(formatted, maxLength);
  }

  // Format for Twitter (concise, under 280 chars)
  private formatForTwitter(content: string, hashtags: string[], maxLength = 280): string {
    let formatted = content;
    
    // Add hashtags if space allows
    if (hashtags.length > 0) {
      const hashtagString = ' ' + hashtags.slice(0, 3).map(tag => `#${tag.replace('#', '')}`).join(' ');
      if ((formatted + hashtagString).length <= maxLength) {
        formatted += hashtagString;
      }
    }
    
    return this.truncateText(formatted, maxLength, '...');
  }

  // Format for Facebook (community-focused, longer form)
  private formatForFacebook(content: string, hashtags: string[], maxLength = 8000): string {
    let formatted = content;
    
    // Add conversation starters
    if (!formatted.includes('?') && !formatted.includes('What do you think')) {
      formatted += '\n\nWhat do you think?';
    }
    
    // Add hashtags moderately
    if (hashtags.length > 0) {
      const hashtagString = '\n\n' + hashtags.slice(0, 5).map(tag => `#${tag.replace('#', '')}`).join(' ');
      formatted += hashtagString;
    }
    
    return this.truncateText(formatted, maxLength);
  }

  // Extract hashtags from text
  private extractHashtags(text: string): string[] {
    const hashtagRegex = /#[\w\u0590-\u05ff]+/g;
    const matches = text.match(hashtagRegex) || [];
    return matches.map(tag => tag.substring(1).toLowerCase());
  }

  // Extract mentions from text
  private extractMentions(text: string): string[] {
    const mentionRegex = /@[\w]+/g;
    const matches = text.match(mentionRegex) || [];
    return matches.map(mention => mention.toLowerCase());
  }

  // Extract keywords for tagging
  private extractKeywords(text: string): string[] {
    if (!text) return [];
    
    // Simple keyword extraction (could be enhanced with NLP)
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    // Remove common stop words
    const stopWords = ['this', 'that', 'with', 'from', 'they', 'been', 'have', 'were', 'said', 'each', 'which', 'their'];
    const keywords = words.filter(word => !stopWords.includes(word));
    
    // Return unique keywords
    return [...new Set(keywords)].slice(0, 10);
  }

  // Clean and normalize text content
  private cleanText(text: string): string {
    if (!text) return '';
    
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // Parse ISO 8601 duration (YouTube format)
  private parseDuration(duration: string): number | undefined {
    if (!duration) return undefined;
    
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return undefined;
    
    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    const seconds = parseInt(match[3]) || 0;
    
    return hours * 3600 + minutes * 60 + seconds;
  }

  // Add line breaks for readability
  private addLineBreaks(text: string): string {
    // Add line breaks after sentences
    return text
      .replace(/\. /g, '.\n\n')
      .replace(/! /g, '!\n\n')
      .replace(/\? /g, '?\n\n');
  }

  // Convert to title case
  private toTitleCase(text: string): string {
    return text.replace(/\w\S*/g, (txt) => 
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  }

  // Truncate text to specified length
  private truncateText(text: string, maxLength: number, suffix = ''): string {
    if (text.length <= maxLength) return text;
    
    const truncated = text.substring(0, maxLength - suffix.length);
    const lastSpace = truncated.lastIndexOf(' ');
    
    // Try to break at word boundary
    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + suffix;
    }
    
    return truncated + suffix;
  }

  // Create fallback post for normalization errors
  private createFallbackPost(rawPost: RawPost, platform: string): NormalizedPost {
    return {
      id: rawPost.id || `${platform}_${Date.now()}`,
      platform,
      url: rawPost.url || rawPost.permalink || '#',
      type: 'longform',
      creator: {
        handle: '@unknown',
        id: 'unknown',
        displayName: 'Unknown User'
      },
      text: rawPost.text || rawPost.caption || rawPost.message || 'Content not available',
      tags: [],
      stats: {
        likes: 0,
        comments: 0,
        shares: 0,
        views: 0
      },
      timePublished: rawPost.timestamp || rawPost.created_time || new Date().toISOString(),
      thumbnail: rawPost.thumbnail_url || rawPost.media_url
    };
  }

  // Validate normalized post
  validateNormalizedPost(post: NormalizedPost): boolean {
    return !!(
      post.id &&
      post.platform &&
      post.type &&
      post.creator &&
      post.text &&
      post.timePublished &&
      post.stats
    );
  }

  // Get platform-specific content limits
  getPlatformLimits(platform: string): { maxLength: number; maxHashtags: number; supportsMedia: boolean } {
    const limits = {
      instagram: { maxLength: 2200, maxHashtags: 30, supportsMedia: true },
      youtube: { maxLength: 5000, maxHashtags: 15, supportsMedia: true },
      twitter: { maxLength: 280, maxHashtags: 10, supportsMedia: true },
      facebook: { maxLength: 8000, maxHashtags: 20, supportsMedia: true }
    };

    return limits[platform as keyof typeof limits] || { maxLength: 1000, maxHashtags: 10, supportsMedia: false };
  }
}

export const contentNormalizer = new ContentNormalizerService();
