const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [20, 'Username cannot exceed 20 characters'],
      match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Never return password in queries by default
    },
    balance: {
      type: Number,
      default: 1000,
      min: [0, 'Balance cannot be negative'],
    },
    // Provably fair seeds
    serverSeed: {
      type: String,
      required: true,
    },
    serverSeedHashed: {
      type: String,
      required: true,
    },
    clientSeed: {
      type: String,
      default: () => Math.random().toString(36).substring(2, 15),
    },
    nonce: {
      type: Number,
      default: 0,
    },
    totalBets: {
      type: Number,
      default: 0,
    },
    totalWagered: {
      type: Number,
      default: 0,
    },
    totalProfit: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// ─── Hash password before saving ─────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ─── Instance method: compare password ───────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ─── Instance method: safe user object (no sensitive fields) ─────────────────
userSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    username: this.username,
    email: this.email,
    balance: this.balance,
    clientSeed: this.clientSeed,
    serverSeedHashed: this.serverSeedHashed,
    nonce: this.nonce,
    totalBets: this.totalBets,
    totalWagered: this.totalWagered,
    totalProfit: this.totalProfit,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
