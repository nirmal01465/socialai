import mongoose, { Schema, Document } from 'mongoose';

export interface IPost extends Document {
  id: string; // External platform ID
  platform: 'instagram' | 'youtube' | 'twitter' | 'facebook';
  url: string;
  type: 'short' | 'longform' | 'image' | 'thread' | 'live';
  creator: {
    handle: string;
    id: string;
    displayName: string;
    profilePicture?: string;
    followerCount?: number;
    verified?: boolean;
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
  timePublished: Date;
  thumbnail?: string;
  mediaUrl?: string;
  metadata: {
    aiAnalysis?: {
      sentiment: {
        rating: number;
        confidence: number;
      };
      topics: string[];
      engagementPotential: number;
      complexity: number;
      contentType: string;
    };
    contentVector?: number[];
    qualityScore?: number;
    language?: string;
    location?: {
      name: string;
      coordinates?: [number, number];
    };
    hashtags?: string[];
    mentions?: string[];
  };
  seenByUsers: string[]; // User IDs who have seen this post
  lastSeen: Date;
  aiRankingScore?: number;
  engagementHistory: Array<{
    userId: string;
    eventType: 'view' | 'like' | 'skip' | 'comment' | 'share' | 'save';
    timestamp: Date;
    dwellTime?: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  contentWarnings?: string[];
  ageRestriction?: number;
}

const PostSchema = new Schema<IPost>({
  id: {
    type: String,
    required: true,
    index: true
  },
  platform: {
    type: String,
    enum: ['instagram', 'youtube', 'twitter', 'facebook'],
    required: true,
    index: true
  },
  url: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['short', 'longform', 'image', 'thread', 'live'],
    required: true,
    index: true
  },
  creator: {
    handle: {
      type: String,
      required: true,
      index: true
    },
    id: {
      type: String,
      required: true
    },
    displayName: {
      type: String,
      required: true
    },
    profilePicture: {
      type: String,
      default: null
    },
    followerCount: {
      type: Number,
      default: 0
    },
    verified: {
      type: Boolean,
      default: false
    }
  },
  text: {
    type: String,
    required: true,
    index: 'text' // Text search index
  },
  tags: [{
    type: String,
    index: true
  }],
  durationS: {
    type: Number,
    default: null
  },
  stats: {
    likes: {
      type: Number,
      default: 0,
      min: 0
    },
    comments: {
      type: Number,
      default: 0,
      min: 0
    },
    shares: {
      type: Number,
      default: 0,
      min: 0
    },
    views: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  timePublished: {
    type: Date,
    required: true,
    index: true
  },
  thumbnail: {
    type: String,
    default: null
  },
  mediaUrl: {
    type: String,
    default: null
  },
  metadata: {
    aiAnalysis: {
      sentiment: {
        rating: {
          type: Number,
          min: 1,
          max: 5,
          default: 3
        },
        confidence: {
          type: Number,
          min: 0,
          max: 1,
          default: 0.5
        }
      },
      topics: [{
        type: String
      }],
      engagementPotential: {
        type: Number,
        min: 1,
        max: 10,
        default: 5
      },
      complexity: {
        type: Number,
        min: 1,
        max: 10,
        default: 5
      },
      contentType: {
        type: String,
        default: 'general'
      }
    },
    contentVector: [{
      type: Number
    }],
    qualityScore: {
      type: Number,
      min: 0,
      max: 10,
      default: 5
    },
    language: {
      type: String,
      default: 'en'
    },
    location: {
      name: {
        type: String,
        default: null
      },
      coordinates: {
        type: [Number],
        default: null,
        index: '2dsphere'
      }
    },
    hashtags: [{
      type: String
    }],
    mentions: [{
      type: String
    }]
  },
  seenByUsers: [{
    type: String,
    index: true
  }],
  lastSeen: {
    type: Date,
    default: Date.now
  },
  aiRankingScore: {
    type: Number,
    default: 0,
    index: true
  },
  engagementHistory: [{
    userId: {
      type: String,
      required: true
    },
    eventType: {
      type: String,
      enum: ['view', 'like', 'skip', 'comment', 'share', 'save'],
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    dwellTime: {
      type: Number,
      default: null
    }
  }],
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  contentWarnings: [{
    type: String
  }],
  ageRestriction: {
    type: Number,
    default: null,
    min: 13
  }
}, {
  timestamps: true
});

// Compound indexes for efficient querying
PostSchema.index({ platform: 1, timePublished: -1 });
PostSchema.index({ 'creator.handle': 1, timePublished: -1 });
PostSchema.index({ tags: 1, timePublished: -1 });
PostSchema.index({ type: 1, 'stats.likes': -1 });
PostSchema.index({ 'metadata.aiAnalysis.topics': 1 });
PostSchema.index({ aiRankingScore: -1, timePublished: -1 });
PostSchema.index({ platform: 1, id: 1 }, { unique: true });

// Virtual for total engagement
PostSchema.virtual('totalEngagement').get(function() {
  return this.stats.likes + this.stats.comments + this.stats.shares;
});

// Virtual for engagement rate (if we have views)
PostSchema.virtual('engagementRate').get(function() {
  if (this.stats.views === 0) return 0;
  return (this.totalEngagement / this.stats.views) * 100;
});

// Virtual for post age in hours
PostSchema.virtual('ageHours').get(function() {
  return Math.floor((Date.now() - this.timePublished.getTime()) / (1000 * 60 * 60));
});

// Virtual for content freshness score (higher for newer content)
PostSchema.virtual('freshnessScore').get(function() {
  const hoursOld = this.ageHours;
  return Math.max(0, 10 - (hoursOld / 24));
});

// Method to calculate trending score
PostSchema.methods.calculateTrendingScore = function(): number {
  const engagementScore = Math.log(this.totalEngagement + 1);
  const freshnessScore = this.freshnessScore;
  const qualityScore = this.metadata?.qualityScore || 5;
  const aiScore = this.aiRankingScore || 0;
  
  return (engagementScore * 0.4) + (freshnessScore * 0.3) + (qualityScore * 0.2) + (aiScore * 0.1);
};

// Method to check if post is trending
PostSchema.methods.isTrending = function(): boolean {
  const trendingThreshold = 7; // Configurable threshold
  return this.calculateTrendingScore() > trendingThreshold;
};

// Method to add engagement event
PostSchema.methods.addEngagementEvent = function(userId: string, eventType: string, dwellTime?: number) {
  this.engagementHistory.push({
    userId,
    eventType,
    timestamp: new Date(),
    dwellTime
  });
  
  // Update seen by users
  if (!this.seenByUsers.includes(userId)) {
    this.seenByUsers.push(userId);
  }
  
  this.lastSeen = new Date();
};

// Method to get engagement for specific user
PostSchema.methods.getUserEngagement = function(userId: string) {
  return this.engagementHistory.filter(event => event.userId === userId);
};

// Method to check if user has seen this post
PostSchema.methods.hasUserSeen = function(userId: string): boolean {
  return this.seenByUsers.includes(userId);
};

// Method to get similar posts based on tags and topics
PostSchema.methods.getSimilarPosts = async function(limit: number = 5) {
  const tags = this.tags;
  const topics = this.metadata?.aiAnalysis?.topics || [];
  
  return this.constructor.find({
    _id: { $ne: this._id },
    $or: [
      { tags: { $in: tags } },
      { 'metadata.aiAnalysis.topics': { $in: topics } }
    ],
    isActive: true
  })
  .sort({ aiRankingScore: -1, timePublished: -1 })
  .limit(limit);
};

// Static method to find trending posts
PostSchema.statics.findTrending = function(timeframe: string = '24h', limit: number = 20) {
  const timeThresholds: { [key: string]: number } = {
    '1h': 1 * 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000
  };
  
  const threshold = new Date(Date.now() - (timeThresholds[timeframe] || timeThresholds['24h']));
  
  return this.aggregate([
    {
      $match: {
        timePublished: { $gte: threshold },
        isActive: true
      }
    },
    {
      $addFields: {
        totalEngagement: {
          $add: ['$stats.likes', '$stats.comments', '$stats.shares']
        },
        ageHours: {
          $divide: [
            { $subtract: [new Date(), '$timePublished'] },
            3600000
          ]
        }
      }
    },
    {
      $addFields: {
        trendingScore: {
          $add: [
            { $multiply: [{ $ln: { $add: ['$totalEngagement', 1] } }, 0.4] },
            { $multiply: [{ $max: [0, { $subtract: [10, { $divide: ['$ageHours', 24] }] }] }, 0.3] },
            { $multiply: [{ $ifNull: ['$metadata.qualityScore', 5] }, 0.02] },
            { $multiply: [{ $ifNull: ['$aiRankingScore', 0] }, 0.1] }
          ]
        }
      }
    },
    { $sort: { trendingScore: -1 } },
    { $limit: limit }
  ]);
};

// Static method to get content analytics
PostSchema.statics.getContentAnalytics = function(timeframe: string = '7d') {
  const timeThresholds: { [key: string]: number } = {
    '1d': 1 * 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000
  };
  
  const threshold = new Date(Date.now() - (timeThresholds[timeframe] || timeThresholds['7d']));
  
  return this.aggregate([
    {
      $match: {
        timePublished: { $gte: threshold },
        isActive: true
      }
    },
    {
      $group: {
        _id: null,
        totalPosts: { $sum: 1 },
        totalEngagement: { 
          $sum: { 
            $add: ['$stats.likes', '$stats.comments', '$stats.shares'] 
          } 
        },
        avgEngagement: { 
          $avg: { 
            $add: ['$stats.likes', '$stats.comments', '$stats.shares'] 
          } 
        },
        topPlatforms: {
          $push: '$platform'
        },
        topTypes: {
          $push: '$type'
        },
        avgQualityScore: { $avg: '$metadata.qualityScore' }
      }
    }
  ]);
};

// Pre-save middleware to update AI ranking score
PostSchema.pre('save', function(next) {
  if (this.isModified('stats') || this.isModified('engagementHistory')) {
    // Recalculate AI ranking score based on engagement
    const engagementScore = Math.log(this.totalEngagement + 1);
    const freshnessScore = this.freshnessScore;
    const qualityScore = this.metadata?.qualityScore || 5;
    
    this.aiRankingScore = (engagementScore * 0.5) + (freshnessScore * 0.3) + (qualityScore * 0.2);
  }
  next();
});

const Post = mongoose.model<IPost>('Post', PostSchema);
export default Post;
