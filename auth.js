const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('./User');
const { generateServerSeed, hashServerSeed } = require('./provablyFair');

const router = express.Router();

// ─── Helper: sign JWT ────────────────────────────────────────────────────────
function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// ─── POST /api/auth/register ─────────────────────────────────────────────────
router.post(
  '/register',
  [
    body('username')
      .trim()
      .isLength({ min: 3, max: 20 })
      .withMessage('Username must be 3–20 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, underscores'),
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase, and a number'),
  ],
  async (req, res) => {
    // Validate inputs
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { username, email, password } = req.body;

      // Check duplicates
      const existingUser = await User.findOne({
        $or: [{ username: username }, { email: email.toLowerCase() }],
      });

      if (existingUser) {
        const field = existingUser.username === username ? 'Username' : 'Email';
        return res.status(409).json({ error: `${field} is already taken` });
      }

      // Generate initial provably fair seeds
      const serverSeed = generateServerSeed();
      const serverSeedHashed = hashServerSeed(serverSeed);

      // Create user
      const user = await User.create({
        username,
        email,
        password,
        serverSeed,
        serverSeedHashed,
        balance: parseInt(process.env.DEFAULT_BALANCE) || 1000,
      });

      const token = signToken(user._id);

      res.status(201).json({
        message: 'Account created successfully!',
        token,
        user: user.toPublicJSON(),
      });
    } catch (err) {
      console.error('Register error:', err);
      // Handle mongoose duplicate key error
      if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return res.status(409).json({ error: `${field} is already taken` });
      }
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// ─── POST /api/auth/login ────────────────────────────────────────────────────
router.post(
  '/login',
  [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { username, password } = req.body;

      // Fetch user WITH password (it's select:false by default)
      const user = await User.findOne({ username }).select('+password');

      if (!user) {
        // Use generic message to prevent username enumeration
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const token = signToken(user._id);

      res.json({
        message: 'Login successful',
        token,
        user: user.toPublicJSON(),
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

module.exports = router;
