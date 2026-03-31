const mongoose = require('mongoose');

const betSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    game: {
      type: String,
      enum: ['dice', 'limbo', 'coinflip'],
      required: true,
    },
    betAmount: {
      type: Number,
      required: true,
      min: [1, 'Minimum bet is 1 point'],
    },
    // Game-specific parameters
    gameParams: {
      // Dice: winChance (1-98)
      // Limbo: targetMultiplier (1.01+)
      // Coinflip: side ('heads'|'tails')
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    // Provably fair data (snapshot at time of bet)
    serverSeedHashed: { type: String, required: true },
    clientSeed: { type: String, required: true },
    nonce: { type: Number, required: true },
    // After reveal, the actual server seed can be stored
    serverSeedRevealed: { type: String, default: null },
    // Outcome
    result: {
      // The raw RNG number generated (0-99.99 for dice, multiplier for limbo, 0/1 for coinflip)
      rawValue: { type: Number, required: true },
      won: { type: Boolean, required: true },
      multiplier: { type: Number, required: true },
      payout: { type: Number, required: true },
    },
    profit: {
      type: Number,
      required: true,
    },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
  },
  { timestamps: true }
);

// Index for efficient history queries
betSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Bet', betSchema);
