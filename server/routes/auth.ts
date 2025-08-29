import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Register new user
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  body('name').trim().isLength({ min: 2, max: 50 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = new User({
      email,
      password: hashedPassword,
      name,
      preferences: {
        theme: 'auto',
        notifications: true,
        dataSharing: 'balanced'
      },
      connectedPlatforms: [],
      behaviorSummary: {
        totalEvents: 0,
        topTags: [],
        topCreators: [],
        preferredContentTypes: [],
        avgSessionDuration: 0
      }
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        connectedPlatforms: user.connectedPlatforms,
        preferences: user.preferences
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Login user
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        connectedPlatforms: user.connectedPlatforms,
        preferences: user.preferences,
        behaviorSummary: user.behaviorSummary
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user preferences
router.patch('/preferences', authMiddleware, [
  body('theme').optional().isIn(['light', 'dark', 'auto']),
  body('notifications').optional().isBoolean(),
  body('dataSharing').optional().isIn(['strict', 'balanced', 'open'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const updates = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: { preferences: { ...updates } } },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Preferences updated', user });
  } catch (error) {
    console.error('Preferences update error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Social platform OAuth callback
router.post('/oauth/:platform', authMiddleware, async (req, res) => {
  try {
    const { platform } = req.params;
    const { accessToken, refreshToken, profile } = req.body;

    if (!['instagram', 'youtube', 'twitter', 'facebook'].includes(platform)) {
      return res.status(400).json({ error: 'Unsupported platform' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove existing connection for this platform
    user.connectedPlatforms = user.connectedPlatforms.filter(
      (conn: any) => conn.platform !== platform
    );

    // Add new connection
    user.connectedPlatforms.push({
      platform,
      accessToken,
      refreshToken,
      profile: {
        id: profile.id,
        username: profile.username,
        displayName: profile.displayName,
        profilePicture: profile.profilePicture
      },
      connectedAt: new Date(),
      isActive: true
    });

    await user.save();

    res.json({
      message: `${platform} connected successfully`,
      connectedPlatforms: user.connectedPlatforms.map((conn: any) => ({
        platform: conn.platform,
        username: conn.profile.username,
        displayName: conn.profile.displayName,
        connectedAt: conn.connectedAt,
        isActive: conn.isActive
      }))
    });
  } catch (error) {
    console.error('OAuth connection error:', error);
    res.status(500).json({ error: 'Failed to connect platform' });
  }
});

// Disconnect social platform
router.delete('/oauth/:platform', authMiddleware, async (req, res) => {
  try {
    const { platform } = req.params;

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const initialLength = user.connectedPlatforms.length;
    user.connectedPlatforms = user.connectedPlatforms.filter(
      (conn: any) => conn.platform !== platform
    );

    if (user.connectedPlatforms.length === initialLength) {
      return res.status(404).json({ error: 'Platform connection not found' });
    }

    await user.save();

    res.json({
      message: `${platform} disconnected successfully`,
      connectedPlatforms: user.connectedPlatforms.map((conn: any) => ({
        platform: conn.platform,
        username: conn.profile.username,
        displayName: conn.profile.displayName,
        connectedAt: conn.connectedAt,
        isActive: conn.isActive
      }))
    });
  } catch (error) {
    console.error('OAuth disconnection error:', error);
    res.status(500).json({ error: 'Failed to disconnect platform' });
  }
});

// Refresh access token
router.post('/refresh', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate new JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    res.json({ token });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

export default router;
