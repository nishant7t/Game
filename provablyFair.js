/**
 * PROVABLY FAIR SYSTEM
 * ─────────────────────────────────────────────────────────────────────────────
 * How it works:
 *
 * 1. Before any bet, the server has a "serverSeed" (random string). The user
 *    only sees its SHA256 hash (serverSeedHashed). This COMMITS the server to
 *    a specific outcome without revealing it.
 *
 * 2. The user provides (or we auto-generate) a "clientSeed". This is their
 *    contribution to the randomness - the server cannot know it in advance.
 *
 * 3. A "nonce" increments with each bet, ensuring each bet produces a unique
 *    result even with the same seeds.
 *
 * 4. Result = HMAC-SHA256(serverSeed, clientSeed:nonce)
 *    → converted to a float in [0, 1)
 *
 * 5. AFTER the bet, the user can request the serverSeed to be revealed.
 *    They can then independently verify:
 *      - hash(serverSeed) === serverSeedHashed  ✓ (server didn't cheat)
 *      - Re-compute the result using the formula ✓ (outcome is deterministic)
 *
 * 6. After revealing, a new serverSeed is generated so future bets stay fair.
 */

const crypto = require('crypto');

// ─── Core: Generate a cryptographically secure random seed ───────────────────
function generateServerSeed() {
  return crypto.randomBytes(32).toString('hex');
}

// ─── Hash a seed (what we show users before revealing) ───────────────────────
function hashServerSeed(serverSeed) {
  return crypto.createHash('sha256').update(serverSeed).digest('hex');
}

// ─── Core RNG: float in [0, 1) from seeds + nonce ────────────────────────────
function generateFloat(serverSeed, clientSeed, nonce) {
  const hmac = crypto.createHmac('sha256', serverSeed);
  hmac.update(`${clientSeed}:${nonce}`);
  const hex = hmac.digest('hex');

  // Take first 8 hex chars (32 bits) and convert to float
  // This gives us a uniformly distributed float in [0, 1)
  const decimal = parseInt(hex.slice(0, 8), 16);
  return decimal / Math.pow(2, 32);
}

// ─── Game: DICE ───────────────────────────────────────────────────────────────
// User picks a win chance (1–98%). If roll < winChance, they win.
// House edge: 1%
// Multiplier = (100 - houseEdge) / winChance
//
// Example: win chance 50% → multiplier = 99/50 = 1.98x
function resolveDice(serverSeed, clientSeed, nonce, winChance) {
  if (winChance < 1 || winChance > 98) {
    throw new Error('Win chance must be between 1 and 98');
  }

  const HOUSE_EDGE = 0.01; // 1%
  const float = generateFloat(serverSeed, clientSeed, nonce);
  const roll = parseFloat((float * 100).toFixed(2)); // 0.00 – 99.99

  const won = roll < winChance;
  const multiplier = parseFloat(((1 - HOUSE_EDGE) / (winChance / 100)).toFixed(4));

  return { rawValue: roll, won, multiplier };
}

// ─── Game: LIMBO ─────────────────────────────────────────────────────────────
// Server generates a random multiplier using crash curve distribution.
// User bets on a target multiplier. If generated >= target, they win.
// House edge: 1%
//
// Crash curve: multiplier = 1 / (1 - e) where e is uniform [0,1)
// Capped at 1,000,000x for sanity.
function resolveLimbo(serverSeed, clientSeed, nonce, targetMultiplier) {
  if (targetMultiplier < 1.01) {
    throw new Error('Target multiplier must be at least 1.01');
  }
  if (targetMultiplier > 1000000) {
    throw new Error('Target multiplier cannot exceed 1,000,000');
  }

  const HOUSE_EDGE = 0.01;
  const float = generateFloat(serverSeed, clientSeed, nonce);

  // Crash curve formula — produces exponential distribution
  // Prevents always generating low multipliers
  let generated;
  if (float >= 1 - HOUSE_EDGE) {
    generated = 1.0; // house wins (1% of the time)
  } else {
    generated = parseFloat((1 / (1 - float)).toFixed(2));
    generated = Math.min(generated, 1000000);
  }

  const won = generated >= targetMultiplier;
  const multiplier = won ? targetMultiplier : 0;

  return { rawValue: generated, won, multiplier };
}

// ─── Game: COINFLIP ──────────────────────────────────────────────────────────
// 50/50 heads or tails. House edge: 1%
// Win multiplier: 1.98x (not 2x due to house edge)
function resolveCoinflip(serverSeed, clientSeed, nonce, chosenSide) {
  if (!['heads', 'tails'].includes(chosenSide)) {
    throw new Error("Side must be 'heads' or 'tails'");
  }

  const HOUSE_EDGE = 0.01;
  const float = generateFloat(serverSeed, clientSeed, nonce);
  const result = float < 0.5 ? 'heads' : 'tails';

  const won = result === chosenSide;
  const multiplier = won ? parseFloat((2 * (1 - HOUSE_EDGE)).toFixed(4)) : 0; // 1.98x

  return { rawValue: float < 0.5 ? 0 : 1, won, multiplier, resultSide: result };
}

// ─── Verify a past bet (for users checking fairness) ─────────────────────────
function verifyBet({ game, serverSeed, clientSeed, nonce, gameParams }) {
  // First verify the hash
  const expectedHash = hashServerSeed(serverSeed);

  let result;
  switch (game) {
    case 'dice':
      result = resolveDice(serverSeed, clientSeed, nonce, gameParams.winChance);
      break;
    case 'limbo':
      result = resolveLimbo(serverSeed, clientSeed, nonce, gameParams.targetMultiplier);
      break;
    case 'coinflip':
      result = resolveCoinflip(serverSeed, clientSeed, nonce, gameParams.side);
      break;
    default:
      throw new Error('Unknown game type');
  }

  return { expectedHash, result };
}

module.exports = {
  generateServerSeed,
  hashServerSeed,
  generateFloat,
  resolveDice,
  resolveLimbo,
  resolveCoinflip,
  verifyBet,
};
