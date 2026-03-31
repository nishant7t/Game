const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { protect } = require('./protect');
const User = require('./User');
const Bet = require('./Bet');
const {
  resolveDice,
  resolveLimbo,
  resolveCoinflip,
  verifyBet,
} = require('./provablyFair');

const router = express.Router();

// Strict rate limit for betting (prevent abuse)
const betLimiter = rateLimit({
  windowMs: 1000, // 1 second window
  max: 5, // Max 5 bets per second per IP
  message: { error: 'Too many bets. Please slow down.' },
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
});

// All game routes require auth
router.use(protect);

// ─── Helper: process a bet result ────────────────────────────────────────────
async function processBet({ user, game, betAmount, gameParams, result }) {
  const { won, multiplier, rawValue, resultSide } = result;

  // Calculate payout and profit
  const payout = won ? parseFloat((betAmount * multiplier).toFixed(2)) : 0;
  const profit = parseFloat((payout - betAmount).toFixed(2));
  const newBalance = parseFloat((user.balance + profit).toFixed(2));

  // Create bet record
  const bet = await Bet.create({
    userId: user._id,
    game,
    betAmount,
    gameParams,
    serverSeedHashed: user.serverSeedHashed,
    clientSeed: user.clientSeed,
    nonce: user.nonce,
    result: {
      rawValue,
      won,
      multiplier: won ? multiplier : 0,
      payout,
      ...(resultSide && { side: resultSide }),
    },
    profit,
    balanceBefore: user.balance,
    balanceAfter: newBalance,
  });

  // Update user stats atomically
  await User.findByIdAndUpdate(user._id, {
    $set: { balance: newBalance },
    $inc: {
      nonce: 1,
      totalBets: 1,
      totalWagered: betAmount,
      totalProfit: profit,
    },
  });

  return { bet, newBalance, payout, profit, won, multiplier: won ? multiplier : 0, rawValue, resultSide };
}

// ─── Validation: bet amount ───────────────────────────────────────────────────
const betAmountValidation = body('betAmount')
  .isFloat({ min: 1 })
  .withMessage('Minimum bet is 1 point')
  .custom((value, { req }) => {
    if (value > req.user.balance) {
      throw new Error('Insufficient balance');
    }
    return true;
  });

// ─── POST /api/game/dice ─────────────────────────────────────────────────────
router.post(
  '/dice',
  betLimiter,
  [
    betAmountValidation,
    body('winChance')
      .isFloat({ min: 1, max: 98 })
      .withMessage('Win chance must be between 1 and 98'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { betAmount, winChance } = req.body;
      const user = req.user;

      const result = resolveDice(user.serverSeed, user.clientSeed, user.nonce, winChance);

      const outcome = await processBet({
        user,
        game: 'dice',
        betAmount: parseFloat(betAmount),
        gameParams: { winChance },
        result,
      });

      res.json({
        game: 'dice',
        won: outcome.won,
        roll: outcome.rawValue,           // The dice roll (0.00–99.99)
        winChance,
        multiplier: outcome.multiplier,
        betAmount: parseFloat(betAmount),
        payout: outcome.payout,
        profit: outcome.profit,
        newBalance: outcome.newBalance,
        fairness: {
          serverSeedHashed: user.serverSeedHashed,
          clientSeed: user.clientSeed,
          nonce: user.nonce,
          // Tip: rotate seeds to reveal serverSeed and verify this bet
        },
        betId: outcome.bet._id,
      });
    } catch (err) {
      console.error('Dice error:', err);
      res.status(500).json({ error: 'Game error' });
    }
  }
);

// ─── POST /api/game/limbo ────────────────────────────────────────────────────
router.post(
  '/limbo',
  betLimiter,
  [
    betAmountValidation,
    body('targetMultiplier')
      .isFloat({ min: 1.01, max: 1000000 })
      .withMessage('Target multiplier must be between 1.01 and 1,000,000'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { betAmount, targetMultiplier } = req.body;
      const user = req.user;

      const result = resolveLimbo(
        user.serverSeed,
        user.clientSeed,
        user.nonce,
        parseFloat(targetMultiplier)
      );

      const outcome = await processBet({
        user,
        game: 'limbo',
        betAmount: parseFloat(betAmount),
        gameParams: { targetMultiplier: parseFloat(targetMultiplier) },
        result,
      });

      res.json({
        game: 'limbo',
        won: outcome.won,
        generatedMultiplier: outcome.rawValue,  // What the server actually generated
        targetMultiplier: parseFloat(targetMultiplier),
        multiplier: outcome.multiplier,
        betAmount: parseFloat(betAmount),
        payout: outcome.payout,
        profit: outcome.profit,
        newBalance: outcome.newBalance,
        fairness: {
          serverSeedHashed: user.serverSeedHashed,
          clientSeed: user.clientSeed,
          nonce: user.nonce,
        },
        betId: outcome.bet._id,
      });
    } catch (err) {
      console.error('Limbo error:', err);
      res.status(500).json({ error: 'Game error' });
    }
  }
);

// ─── POST /api/game/coinflip ─────────────────────────────────────────────────
router.post(
  '/coinflip',
  betLimiter,
  [
    betAmountValidation,
    body('side')
      .isIn(['heads', 'tails'])
      .withMessage("Side must be 'heads' or 'tails'"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { betAmount, side } = req.body;
      const user = req.user;

      const result = resolveCoinflip(user.serverSeed, user.clientSeed, user.nonce, side);

      const outcome = await processBet({
        user,
        game: 'coinflip',
        betAmount: parseFloat(betAmount),
        gameParams: { side },
        result,
      });

      res.json({
        game: 'coinflip',
        won: outcome.won,
        chosenSide: side,
        resultSide: result.resultSide,
        multiplier: outcome.multiplier,
        betAmount: parseFloat(betAmount),
        payout: outcome.payout,
        profit: outcome.profit,
        newBalance: outcome.newBalance,
        fairness: {
          serverSeedHashed: user.serverSeedHashed,
          clientSeed: user.clientSeed,
          nonce: user.nonce,
        },
        betId: outcome.bet._id,
      });
    } catch (err) {
      console.error('Coinflip error:', err);
      res.status(500).json({ error: 'Game error' });
    }
  }
);

// ─── POST /api/game/verify ───────────────────────────────────────────────────
// Allows users to verify a past bet's fairness after seed reveal
router.post(
  '/verify',
  [
    body('serverSeed').notEmpty().withMessage('Server seed is required'),
    body('clientSeed').notEmpty().withMessage('Client seed is required'),
    body('nonce').isInt({ min: 0 }).withMessage('Nonce must be a non-negative integer'),
    body('game').isIn(['dice', 'limbo', 'coinflip']).withMessage('Invalid game'),
    body('gameParams').isObject().withMessage('Game params required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { serverSeed, clientSeed, nonce, game, gameParams } = req.body;
      const { expectedHash, result } = verifyBet({ game, serverSeed, clientSeed, nonce, gameParams });

      res.json({
        valid: true,
        serverSeedHash: expectedHash,
        game,
        result,
        explanation: `SHA256(${serverSeed}) = ${expectedHash}. Re-compute HMAC-SHA256(serverSeed, "${clientSeed}:${nonce}") to verify the outcome.`,
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

module.exports = router;
