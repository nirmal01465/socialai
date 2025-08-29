import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  _id: string;
  email: string;
  password: string;
  name: string;
  profilePicture?: string;
  bio?: string;
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    notifications: boolean;
    dataSharing: 'strict' | 'balanced' | 'open';
    language: string;
    timezone: string;
    autoSummary: boolean;
    adaptiveUI: boolean;
  };
  connectedPlatforms: Array<{
    platform: 'instagram' | 'youtube' | 'twitter' | 'facebook';
    accessToken: string;
    refreshToken?: string;
    profile: {
      id: string;
      username: string;
      displayName: string;
      profilePicture?: string;
      followerCount?: number;
      followingCount?: number;
    };
    connectedAt: Date;
    lastSync?: Date;
    isActive: boolean;
    permissions: string[];
    tokenExpiresAt?: Date;
  }>;
  behaviorSummary: {
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
    lastUpdated: Date;
  };
  aiPersonalization: {
    profileVector?: number[];
    topInterests: string[];
    contentPreferences: {
      preferredLength: 'short' | 'medium' | 'long';
      preferredFormats: string[];
      avoidTopics: string[];
    };
    engagementHistory: {
      avgEngagementRate: number;
      bestPerformingContent: string[];
      optimalPostingTimes: Date[];
    };
    lastAIUpdate: Date;
  };
  subscription: {
    plan: 'free' | 'premium' | 'pro';
    status: 'active' | 'cancelled' | 'expired';
    startDate?: Date;
    endDate?: Date;
    features: string[];
  };
  security: {
    lastPasswordChange: Date;
    loginAttempts: number;
    lockedUntil?: Date;
    twoFactorEnabled: boolean;
    twoFactorSecret?: string;
    recoveryTokens: string[];
    suspiciousActivityFlags: string[];
  };
  analytics: {
    totalLogins: number;
    lastLogin?: Date;
    averageSessionDuration: number;
    mostActiveHours: number[];
    deviceTypes: string[];
    locations: string[];
  };
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  isVerified: boolean;
  verificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
}

const UserSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email format']
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  profilePicture: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    maxlength: 500,
    default: ''
  },
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'auto'
    },
    notifications: {
      type: Boolean,
      default: true
    },
    dataSharing: {
      type: String,
      enum: ['strict', 'balanced', 'open'],
      default: 'balanced'
    },
    language: {
      type: String,
      default: 'en'
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    autoSummary: {
      type: Boolean,
      default: true
    },
    adaptiveUI: {
      type: Boolean,
      default: true
    }
  },
  connectedPlatforms: [{
    platform: {
      type: String,
      enum: ['instagram', 'youtube', 'twitter', 'facebook'],
      required: true
    },
    accessToken: {
      type: String,
      required: true
    },
    refreshToken: {
      type: String,
      default: null
    },
    profile: {
      id: {
        type: String,
        required: true
      },
      username: {
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
      followingCount: {
        type: Number,
        default: 0
      }
    },
    connectedAt: {
      type: Date,
      default: Date.now
    },
    lastSync: {
      type: Date,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    permissions: [{
      type: String
    }],
    tokenExpiresAt: {
      type: Date,
      default: null
    }
  }],
  behaviorSummary: {
    totalEvents: {
      type: Number,
      default: 0
    },
    topTags: [{
      type: String
    }],
    topCreators: [{
      type: String
    }],
    preferredContentTypes: [{
      type: String
    }],
    avgSessionDuration: {
      type: Number,
      default: 0
    },
    peakActivityHours: [{
      type: Number,
      min: 0,
      max: 23
    }],
    engagementPatterns: {
      skipRate: {
        type: Number,
        default: 0,
        min: 0,
        max: 1
      },
      likeRate: {
        type: Number,
        default: 0,
        min: 0,
        max: 1
      },
      shareRate: {
        type: Number,
        default: 0,
        min: 0,
        max: 1
      },
      commentRate: {
        type: Number,
        default: 0,
        min: 0,
        max: 1
      }
    },
    moodIndicators: [{
      type: String
    }],
    scrollBehavior: {
      avgDwellTime: {
        type: Number,
        default: 0
      },
      scrollSpeed: {
        type: String,
        enum: ['slow', 'medium', 'fast'],
        default: 'medium'
      },
      sessionTypes: [{
        type: String
      }]
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  aiPersonalization: {
    profileVector: [{
      type: Number
    }],
    topInterests: [{
      type: String
    }],
    contentPreferences: {
      preferredLength: {
        type: String,
        enum: ['short', 'medium', 'long'],
        default: 'medium'
      },
      preferredFormats: [{
        type: String
      }],
      avoidTopics: [{
        type: String
      }]
    },
    engagementHistory: {
      avgEngagementRate: {
        type: Number,
        default: 0
      },
      bestPerformingContent: [{
        type: String
      }],
      optimalPostingTimes: [{
        type: Date
      }]
    },
    lastAIUpdate: {
      type: Date,
      default: Date.now
    }
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'premium', 'pro'],
      default: 'free'
    },
    status: {
      type: String,
      enum: ['active', 'cancelled', 'expired'],
      default: 'active'
    },
    startDate: {
      type: Date,
      default: null
    },
    endDate: {
      type: Date,
      default: null
    },
    features: [{
      type: String
    }]
  },
  security: {
    lastPasswordChange: {
      type: Date,
      default: Date.now
    },
    loginAttempts: {
      type: Number,
      default: 0
    },
    lockedUntil: {
      type: Date,
      default: null
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false
    },
    twoFactorSecret: {
      type: String,
      default: null
    },
    recoveryTokens: [{
      type: String
    }],
    suspiciousActivityFlags: [{
      type: String
    }]
  },
  analytics: {
    totalLogins: {
      type: Number,
      default: 0
    },
    lastLogin: {
      type: Date,
      default: null
    },
    averageSessionDuration: {
      type: Number,
      default: 0
    },
    mostActiveHours: [{
      type: Number,
      min: 0,
      max: 23
    }],
    deviceTypes: [{
      type: String
    }],
    locations: [{
      type: String
    }]
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: {
    type: String,
    default: null
  },
  passwordResetToken: {
    type: String,
    default: null
  },
  passwordResetExpires: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      // Remove sensitive information when converting to JSON
      delete ret.password;
      delete ret.connectedPlatforms?.forEach((platform: any) => {
        delete platform.accessToken;
        delete platform.refreshToken;
      });
      delete ret.security?.twoFactorSecret;
      delete ret.security?.recoveryTokens;
      delete ret.verificationToken;
      delete ret.passwordResetToken;
      return ret;
    }
  }
});

// Indexes for better query performance
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ 'connectedPlatforms.platform': 1 });
UserSchema.index({ 'behaviorSummary.topTags': 1 });
UserSchema.index({ createdAt: 1 });
UserSchema.index({ 'analytics.lastLogin': 1 });
UserSchema.index({ isActive: 1, isVerified: 1 });

// Virtual for connected platform count
UserSchema.virtual('connectedPlatformsCount').get(function() {
  return this.connectedPlatforms.filter(platform => platform.isActive).length;
});

// Virtual for account age
UserSchema.virtual('accountAge').get(function() {
  return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to update behaviorSummary.lastUpdated
UserSchema.pre('save', function(next) {
  if (this.isModified('behaviorSummary')) {
    this.behaviorSummary.lastUpdated = new Date();
  }
  next();
});

// Method to check if user has specific platform connected
UserSchema.methods.hasPlatformConnected = function(platform: string): boolean {
  return this.connectedPlatforms.some((conn: any) => 
    conn.platform === platform && conn.isActive
  );
};

// Method to get platform connection
UserSchema.methods.getPlatformConnection = function(platform: string) {
  return this.connectedPlatforms.find((conn: any) => 
    conn.platform === platform && conn.isActive
  );
};

// Method to add or update platform connection
UserSchema.methods.updatePlatformConnection = function(platform: string, connectionData: any) {
  const existingIndex = this.connectedPlatforms.findIndex((conn: any) => 
    conn.platform === platform
  );
  
  if (existingIndex !== -1) {
    // Update existing connection
    this.connectedPlatforms[existingIndex] = {
      ...this.connectedPlatforms[existingIndex],
      ...connectionData,
      lastSync: new Date()
    };
  } else {
    // Add new connection
    this.connectedPlatforms.push({
      platform,
      ...connectionData,
      connectedAt: new Date(),
      isActive: true
    });
  }
};

// Method to disconnect platform
UserSchema.methods.disconnectPlatform = function(platform: string) {
  const connectionIndex = this.connectedPlatforms.findIndex((conn: any) => 
    conn.platform === platform
  );
  
  if (connectionIndex !== -1) {
    this.connectedPlatforms.splice(connectionIndex, 1);
  }
};

// Method to check if account is locked
UserSchema.methods.isAccountLocked = function(): boolean {
  return this.security.lockedUntil && this.security.lockedUntil > new Date();
};

// Method to increment login attempts
UserSchema.methods.incrementLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.security.lockedUntil && this.security.lockedUntil < new Date()) {
    return this.updateOne({
      $unset: { 'security.lockedUntil': 1 },
      $set: { 'security.loginAttempts': 1 }
    });
  }
  
  const updates = { $inc: { 'security.loginAttempts': 1 } };
  
  // Lock account after 5 attempts for 2 hours
  if (this.security.loginAttempts + 1 >= 5 && !this.isAccountLocked()) {
    (updates as any).$set = { 
      'security.lockedUntil': Date.now() + 2 * 60 * 60 * 1000 
    };
  }
  
  return this.updateOne(updates);
};

// Method to reset login attempts
UserSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { 
      'security.lockedUntil': 1,
      'security.loginAttempts': 1
    }
  });
};

// Method to update behavioral data
UserSchema.methods.updateBehaviorSummary = function(behaviorData: any) {
  this.behaviorSummary = {
    ...this.behaviorSummary,
    ...behaviorData,
    lastUpdated: new Date()
  };
};

// Method to check premium features access
UserSchema.methods.hasPremiumAccess = function(): boolean {
  return ['premium', 'pro'].includes(this.subscription.plan) && 
         this.subscription.status === 'active' &&
         (!this.subscription.endDate || this.subscription.endDate > new Date());
};

// Method to get user's time preferences
UserSchema.methods.getOptimalPostingTimes = function(): Date[] {
  const optimalTimes = this.aiPersonalization.engagementHistory.optimalPostingTimes;
  
  if (optimalTimes && optimalTimes.length > 0) {
    return optimalTimes;
  }
  
  // Default optimal times based on peak activity hours
  const peakHours = this.behaviorSummary.peakActivityHours;
  if (peakHours && peakHours.length > 0) {
    return peakHours.map(hour => {
      const date = new Date();
      date.setHours(hour, 0, 0, 0);
      return date;
    });
  }
  
  // Fallback to general optimal times
  return [
    new Date().setHours(9, 0, 0, 0),
    new Date().setHours(15, 0, 0, 0),
    new Date().setHours(19, 0, 0, 0)
  ].map(time => new Date(time));
};

// Static method to find users by interests
UserSchema.statics.findByInterests = function(interests: string[], limit: number = 10) {
  return this.find({
    'behaviorSummary.topTags': { $in: interests },
    isActive: true
  }).limit(limit);
};

// Static method to get user statistics
UserSchema.statics.getUserStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        activeUsers: { 
          $sum: { 
            $cond: [{ $eq: ['$isActive', true] }, 1, 0] 
          } 
        },
        verifiedUsers: { 
          $sum: { 
            $cond: [{ $eq: ['$isVerified', true] }, 1, 0] 
          } 
        },
        premiumUsers: { 
          $sum: { 
            $cond: [
              { $in: ['$subscription.plan', ['premium', 'pro']] }, 
              1, 
              0
            ] 
          } 
        },
        avgConnectedPlatforms: { $avg: { $size: '$connectedPlatforms' } }
      }
    }
  ]);
};

// Export the model
const User = mongoose.model<IUser>('User', UserSchema);
export default User;
