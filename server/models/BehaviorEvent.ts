import mongoose, { Schema, Document } from 'mongoose';

export interface IBehaviorEvent extends Document {
  userId: string;
  postId: string;
  eventType: 'view' | 'like' | 'skip' | 'comment' | 'share' | 'save' | 'click' | 'scroll' | 'pause' | 'resume';
  timestamp: Date;
  dwellTime?: number; // Time spent viewing in milliseconds
  scrollDepth?: number; // Percentage of content scrolled (0-100)
  sessionId: string;
  metadata: {
    platform?: string;
    deviceType?: 'mobile' | 'tablet' | 'desktop';
    contentType?: string;
    scrollSpeed?: 'slow' | 'medium' | 'fast';
    interactionContext?: string; // Where the interaction happened (feed, search, trending, etc.)
    referrer?: string;
    timeOfDay?: number; // Hour of day (0-23)
    userMood?: string; // Inferred or explicitly set mood
    networkType?: 'wifi' | 'cellular' | 'unknown';
    batteryLevel?: number;
    isNewUser?: boolean;
    location?: {
      city?: string;
      country?: string;
      timezone?: string;
    };
  };
  qualityMetrics: {
    loadTime?: number; // Time to load content
    renderTime?: number; // Time to render
    errorCount?: number; // Any errors during interaction
    completionRate?: number; // For video/long content (0-1)
  };
  contextualData: {
    precedingEvents?: string[]; // Previous 3 events
    followingAction?: string; // What happened next
    sessionDuration?: number; // Total session time at this point
    feedPosition?: number; // Position in feed when interaction occurred
    totalItemsViewed?: number; // Items viewed in this session
    searchQuery?: string; // If this came from search
    filterApplied?: string[]; // Any active filters
  };
  aiPredictions?: {
    engagementProbability?: number;
    nextActionPrediction?: string;
    contentRelevanceScore?: number;
    moodPrediction?: string;
  };
  createdAt: Date;
  processed: boolean; // Whether this event has been processed for analytics
  batchId?: string; // For batch processing
}

const BehaviorEventSchema = new Schema<IBehaviorEvent>({
  userId: {
    type: String,
    required: true,
    index: true
  },
  postId: {
    type: String,
    required: true,
    index: true
  },
  eventType: {
    type: String,
    enum: ['view', 'like', 'skip', 'comment', 'share', 'save', 'click', 'scroll', 'pause', 'resume'],
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  dwellTime: {
    type: Number,
    default: null,
    min: 0
  },
  scrollDepth: {
    type: Number,
    default: null,
    min: 0,
    max: 100
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  metadata: {
    platform: {
      type: String,
      enum: ['instagram', 'youtube', 'twitter', 'facebook', 'unknown'],
      default: 'unknown'
    },
    deviceType: {
      type: String,
      enum: ['mobile', 'tablet', 'desktop'],
      default: 'desktop'
    },
    contentType: {
      type: String,
      default: null
    },
    scrollSpeed: {
      type: String,
      enum: ['slow', 'medium', 'fast'],
      default: 'medium'
    },
    interactionContext: {
      type: String,
      default: 'feed'
    },
    referrer: {
      type: String,
      default: null
    },
    timeOfDay: {
      type: Number,
      min: 0,
      max: 23,
      default: null
    },
    userMood: {
      type: String,
      default: null
    },
    networkType: {
      type: String,
      enum: ['wifi', 'cellular', 'unknown'],
      default: 'unknown'
    },
    batteryLevel: {
      type: Number,
      min: 0,
      max: 100,
      default: null
    },
    isNewUser: {
      type: Boolean,
      default: false
    },
    location: {
      city: {
        type: String,
        default: null
      },
      country: {
        type: String,
        default: null
      },
      timezone: {
        type: String,
        default: null
      }
    }
  },
  qualityMetrics: {
    loadTime: {
      type: Number,
      default: null,
      min: 0
    },
    renderTime: {
      type: Number,
      default: null,
      min: 0
    },
    errorCount: {
      type: Number,
      default: 0,
      min: 0
    },
    completionRate: {
      type: Number,
      default: null,
      min: 0,
      max: 1
    }
  },
  contextualData: {
    precedingEvents: [{
      type: String
    }],
    followingAction: {
      type: String,
      default: null
    },
    sessionDuration: {
      type: Number,
      default: null,
      min: 0
    },
    feedPosition: {
      type: Number,
      default: null,
      min: 0
    },
    totalItemsViewed: {
      type: Number,
      default: null,
      min: 0
    },
    searchQuery: {
      type: String,
      default: null
    },
    filterApplied: [{
      type: String
    }]
  },
  aiPredictions: {
    engagementProbability: {
      type: Number,
      min: 0,
      max: 1,
      default: null
    },
    nextActionPrediction: {
      type: String,
      default: null
    },
    contentRelevanceScore: {
      type: Number,
      min: 0,
      max: 10,
      default: null
    },
    moodPrediction: {
      type: String,
      default: null
    }
  },
  processed: {
    type: Boolean,
    default: false,
    index: true
  },
  batchId: {
    type: String,
    default: null,
    index: true
  }
}, {
  timestamps: { createdAt: true, updatedAt: false } // Only track creation time
});

// Compound indexes for efficient querying
BehaviorEventSchema.index({ userId: 1, timestamp: -1 });
BehaviorEventSchema.index({ userId: 1, eventType: 1, timestamp: -1 });
BehaviorEventSchema.index({ postId: 1, eventType: 1 });
BehaviorEventSchema.index({ sessionId: 1, timestamp: 1 });
BehaviorEventSchema.index({ 'metadata.platform': 1, timestamp: -1 });
BehaviorEventSchema.index({ processed: 1, timestamp: 1 });
BehaviorEventSchema.index({ userId: 1, processed: 1 });

// Time-based partitioning index for efficient data retention
BehaviorEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // 90 days retention

// Virtual for event age in minutes
BehaviorEventSchema.virtual('ageMinutes').get(function() {
  return Math.floor((Date.now() - this.timestamp.getTime()) / (1000 * 60));
});

// Virtual for is recent (within last hour)
BehaviorEventSchema.virtual('isRecent').get(function() {
  return this.ageMinutes <= 60;
});

// Method to categorize engagement level
BehaviorEventSchema.methods.getEngagementLevel = function(): 'low' | 'medium' | 'high' {
  const highEngagementActions = ['like', 'share', 'comment', 'save'];
  const mediumEngagementActions = ['click', 'pause'];
  
  if (highEngagementActions.includes(this.eventType)) {
    return 'high';
  } else if (mediumEngagementActions.includes(this.eventType)) {
    return 'medium';
  } else {
    // For 'view' and 'skip', check dwell time
    if (this.dwellTime && this.dwellTime > 10000) { // 10 seconds
      return 'medium';
    }
    return 'low';
  }
};

// Method to calculate engagement score
BehaviorEventSchema.methods.calculateEngagementScore = function(): number {
  const baseScores = {
    view: 1,
    skip: 0,
    click: 2,
    like: 3,
    share: 5,
    comment: 4,
    save: 4,
    scroll: 0.5,
    pause: 1,
    resume: 1
  };
  
  let score = baseScores[this.eventType as keyof typeof baseScores] || 0;
  
  // Adjust based on dwell time
  if (this.dwellTime) {
    if (this.dwellTime > 30000) score += 2; // 30+ seconds
    else if (this.dwellTime > 10000) score += 1; // 10+ seconds
  }
  
  // Adjust based on scroll depth
  if (this.scrollDepth) {
    if (this.scrollDepth > 80) score += 1;
    else if (this.scrollDepth > 50) score += 0.5;
  }
  
  return score;
};

// Method to check if event indicates user interest
BehaviorEventSchema.methods.indicatesInterest = function(): boolean {
  const interestActions = ['like', 'share', 'comment', 'save', 'click'];
  
  if (interestActions.includes(this.eventType)) {
    return true;
  }
  
  // For views, check dwell time and scroll depth
  if (this.eventType === 'view') {
    return (this.dwellTime && this.dwellTime > 5000) || 
           (this.scrollDepth && this.scrollDepth > 50);
  }
  
  return false;
};

// Static method to get user behavior summary
BehaviorEventSchema.statics.getUserBehaviorSummary = function(
  userId: string, 
  timeframe: number = 7 * 24 * 60 * 60 * 1000 // 7 days default
) {
  const threshold = new Date(Date.now() - timeframe);
  
  return this.aggregate([
    {
      $match: {
        userId,
        timestamp: { $gte: threshold }
      }
    },
    {
      $group: {
        _id: '$eventType',
        count: { $sum: 1 },
        avgDwellTime: { $avg: '$dwellTime' },
        avgScrollDepth: { $avg: '$scrollDepth' },
        platforms: { $addToSet: '$metadata.platform' },
        contentTypes: { $addToSet: '$metadata.contentType' },
        timeOfDay: { $push: '$metadata.timeOfDay' },
        deviceTypes: { $addToSet: '$metadata.deviceType' }
      }
    },
    {
      $group: {
        _id: null,
        totalEvents: { $sum: '$count' },
        eventTypes: {
          $push: {
            type: '$_id',
            count: '$count',
            avgDwellTime: '$avgDwellTime',
            avgScrollDepth: '$avgScrollDepth'
          }
        },
        platforms: { $addToSet: '$platforms' },
        contentTypes: { $addToSet: '$contentTypes' },
        timeOfDay: { $addToSet: '$timeOfDay' },
        deviceTypes: { $addToSet: '$deviceTypes' }
      }
    }
  ]);
};

// Static method to find similar users based on behavior patterns
BehaviorEventSchema.statics.findSimilarUsers = function(
  userId: string,
  limit: number = 10,
  timeframe: number = 30 * 24 * 60 * 60 * 1000 // 30 days
) {
  const threshold = new Date(Date.now() - timeframe);
  
  return this.aggregate([
    {
      $match: {
        timestamp: { $gte: threshold },
        userId: { $ne: userId }
      }
    },
    {
      $group: {
        _id: '$userId',
        eventTypes: { $addToSet: '$eventType' },
        platforms: { $addToSet: '$metadata.platform' },
        contentTypes: { $addToSet: '$metadata.contentType' },
        avgDwellTime: { $avg: '$dwellTime' },
        totalEvents: { $sum: 1 }
      }
    },
    {
      $limit: limit
    }
  ]);
};

// Static method to get content performance analytics
BehaviorEventSchema.statics.getContentPerformance = function(
  postId: string,
  includeDetailed: boolean = false
) {
  const pipeline: any[] = [
    { $match: { postId } },
    {
      $group: {
        _id: '$eventType',
        count: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' },
        avgDwellTime: { $avg: '$dwellTime' },
        avgScrollDepth: { $avg: '$scrollDepth' },
        deviceTypes: { $addToSet: '$metadata.deviceType' },
        platforms: { $addToSet: '$metadata.platform' }
      }
    },
    {
      $addFields: {
        uniqueUserCount: { $size: '$uniqueUsers' }
      }
    }
  ];
  
  if (includeDetailed) {
    pipeline.push({
      $group: {
        _id: null,
        totalEvents: { $sum: '$count' },
        totalUniqueUsers: { $sum: '$uniqueUserCount' },
        eventBreakdown: {
          $push: {
            eventType: '$_id',
            count: '$count',
            uniqueUsers: '$uniqueUserCount',
            avgDwellTime: '$avgDwellTime',
            avgScrollDepth: '$avgScrollDepth',
            deviceTypes: '$deviceTypes',
            platforms: '$platforms'
          }
        }
      }
    });
  }
  
  return this.aggregate(pipeline);
};

// Static method to get hourly activity patterns
BehaviorEventSchema.statics.getActivityPatterns = function(
  userId: string,
  timeframe: number = 7 * 24 * 60 * 60 * 1000 // 7 days
) {
  const threshold = new Date(Date.now() - timeframe);
  
  return this.aggregate([
    {
      $match: {
        userId,
        timestamp: { $gte: threshold }
      }
    },
    {
      $group: {
        _id: { $hour: '$timestamp' },
        count: { $sum: 1 },
        eventTypes: { $addToSet: '$eventType' },
        avgDwellTime: { $avg: '$dwellTime' }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);
};

// Pre-save middleware to auto-populate metadata
BehaviorEventSchema.pre('save', function(next) {
  // Set time of day if not provided
  if (!this.metadata.timeOfDay) {
    this.metadata.timeOfDay = this.timestamp.getHours();
  }
  
  // Generate batch ID for processing
  if (!this.batchId) {
    const date = this.timestamp.toISOString().split('T')[0];
    const hour = this.timestamp.getHours();
    this.batchId = `${date}-${hour}`;
  }
  
  next();
});

const BehaviorEvent = mongoose.model<IBehaviorEvent>('BehaviorEvent', BehaviorEventSchema);
export default BehaviorEvent;
