const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { protect } = require('./protect');
const User = require('./User');
const Bet = require('./Bet');
const { generateServerSeed, hashServerSeed } = require('./provablyFair');

const router = express.Router();

// All routes require authentication
router.use(protect);

// ─── GET /api/user/me ────────────────────────────────────────────────────────
// Get current user's profile and balance
router.get('/me', async (req, res) => {
  res.json({ user: req.user.toPublicJSON() });
});

// ─── GET /api/user/history ───────────────────────────────────────────────────
// Get paginated bet history
router.get(
  '/history',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
    query('game').optional().isIn(['dice', 'limbo', 'coinflip']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const page = req.query.page || 1;
      const limit = req.query.limit || 20;
      const skip = (page - 1) * limit;

      const filter = { userId: req.user._id };
      if (req.query.game) filter.game = req.query.game;

      const [bets, total] = await Promise.all([
        Bet.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Bet.countDocuments(filter),
      ]);

      res.json({
        bets,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      console.error('History error:', err);
      res.status(500).json({ error: 'Failed to fetch history' });
    }
  }
);

// ─── POST /api/user/seeds/rotate ────────────────────────────────────────────
// User requests a new server seed (reveals old one, generates new one)
// This is an important part of provably fair - users can rotate seeds
// and verify all past bets using the now-revealed old seed.
router.post('/seeds/rotate', async (req, res) => {
  try {
    const user = req.user;
    const oldServerSeed = user.serverSeed; // Reveal this

    // Generate new seeds
    const newServerSeed = generateServerSeed();
    const newServerSeedHashed = hashServerSeed(newServerSeed);

    // Update all unverified bets for this user to store the revealed seed
    await Bet.updateMany(
      { userId: user._id, serverSeedRevealed: null },
      { serverSeedRevealed: oldServerSeed }
    );

    // Update user with new seeds and reset nonce
    user.serverSeed = newServerSeed;
    user.serverSeedHashed = newServerSeedHashed;
    user.nonce = 0;
    await user.save();

    res.json({
      message: 'Seeds rotated successfully. Old seed revealed for verification.',
      revealedServerSeed: oldServerSeed, // User can now verify past bets
      newServerSeedHashed,
    });
  } catch (err) {
    console.error('Seed rotate error:', err);
    res.status(500).json({ error: 'Failed to rotate seeds' });
  }
});

// ─── PUT /api/user/seeds/client ──────────────────────────────────────────────
// User can set their own client seed
router.put(
  '/seeds/client',
  [
    body('clientSeed')
      .trim()
      .isLength({ min: 1, max: 64 })
      .withMessage('Client seed must be 1–64 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const user = req.user;
      user.clientSeed = req.body.clientSeed;
      user.nonce = 0; // Reset nonce when client seed changes
      await user.save();

      res.json({
        message: 'Client seed updated',
        clientSeed: user.clientSeed,
        serverSeedHashed: user.serverSeedHashed,
        nonce: user.nonce,
      });
    } catch (err) {
      console.error('Client seed error:', err);
      res.status(500).json({ error: 'Failed to update client seed' });
    }
  }
);

module.exports = router;
