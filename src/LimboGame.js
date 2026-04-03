import React, { useState } from 'react';
import { playLimbo } from './api';
import { useAuth } from './AuthContext';
import './Game.css';

export default function LimboGame() {
  const { user, updateBalance } = useAuth();
  const [betAmount, setBetAmount] = useState(10);
  const [targetMultiplier, setTargetMultiplier] = useState(2.00);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [flash, setFlash] = useState(null);
  const [error, setError] = useState('');

  // Win chance = (1 - houseEdge) / targetMultiplier * 100
  const winChance = ((0.99 / targetMultiplier) * 100).toFixed(2);
  const potentialProfit = ((betAmount * targetMultiplier) - betAmount).toFixed(2);

  const handleBet = async () => {
    setError('');
    if (betAmount < 1) return setError('Minimum bet is 1');
    if (betAmount > user.balance) return setError('Insufficient balance');
    if (targetMultiplier < 1.01) return setError('Target multiplier must be at least 1.01');

    setLoading(true);
    setResult(null);
    try {
      const res = await playLimbo(betAmount, parseFloat(targetMultiplier));
      const data = res.data;
      setResult(data);
      updateBalance(data.newBalance);
      triggerFlash(data.won ? 'win' : 'loss');
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Bet failed');
    } finally {
      setLoading(false);
    }
  };

  const triggerFlash = (type) => {
    setFlash(type);
    setTimeout(() => setFlash(null), 1300);
  };

  const quickBet = (fn) => {
    setBetAmount((prev) => Math.max(1, Math.min(fn(parseFloat(prev)), user.balance)));
  };

  return (
    <div className="game-page">
      {flash && (
        <div className={`result-overlay ${flash}`}>
          {flash === 'win' ? '🎉 WIN!' : '💀 LOSS'}
        </div>
      )}

      <h1 className="game-title">🚀 Limbo</h1>
      <p className="game-subtitle">
        Set a target multiplier. The server generates a random multiplier — if it's ≥ your target, you win. Higher targets = lower win chance but bigger reward.
      </p>

      {/* Result display */}
      {result && (
        <div className={`limbo-result card ${result.won ? 'won' : 'lost'}`}>
          <div className="limbo-generated">
            <span className="limbo-label">Generated</span>
            <div className={`limbo-value ${result.won ? 'green' : 'red'}`}>
              {result.generatedMultiplier.toFixed(2)}x
            </div>
          </div>
          <div className="limbo-vs">vs</div>
          <div className="limbo-target-display">
            <span className="limbo-label">Your Target</span>
            <div className="limbo-value accent">{targetMultiplier}x</div>
          </div>
          <div className={`roll-verdict ${result.won ? 'green' : 'red'}`}>
            {result.won ? `+${result.profit.toFixed(2)} ⚡` : `-${betAmount} ⚡`}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="card game-controls">
        <div className="form-group">
          <label>Target Multiplier</label>
          <div className="bet-row">
            <input
              type="number"
              min={1.01}
              max={1000000}
              step={0.01}
              value={targetMultiplier}
              onChange={(e) => setTargetMultiplier(parseFloat(e.target.value) || 1.01)}
            />
          </div>
        </div>

        <div className="preset-buttons">
          {[1.5, 2, 3, 5, 10, 100].map((m) => (
            <button key={m} className="btn btn-outline preset-btn" onClick={() => setTargetMultiplier(m)}>
              {m}x
            </button>
          ))}
        </div>

        <div className="stats-mini">
          <div className="stat-mini">
            <span>Win Chance</span>
            <strong className="accent">{winChance}%</strong>
          </div>
          <div className="stat-mini">
            <span>Profit on Win</span>
            <strong className="green">+{potentialProfit}</strong>
          </div>
          <div className="stat-mini">
            <span>Loss on Loss</span>
            <strong className="red">-{betAmount}</strong>
          </div>
        </div>

        <div className="form-group">
          <label>Bet Amount</label>
          <div className="bet-row">
            <input
              type="number"
              min={1}
              max={user?.balance}
              value={betAmount}
              onChange={(e) => setBetAmount(Math.max(1, Number(e.target.value)))}
            />
            <button className="btn btn-outline" onClick={() => quickBet((v) => v / 2)}>½</button>
            <button className="btn btn-outline" onClick={() => quickBet((v) => v * 2)}>2×</button>
            <button className="btn btn-outline" onClick={() => setBetAmount(user?.balance)}>Max</button>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <button className="btn btn-green btn-full bet-btn" onClick={handleBet} disabled={loading}>
          {loading ? 'Launching...' : `🚀 Launch — Bet ${betAmount} ⚡`}
        </button>
      </div>

      {result && (
        <div className="fairness-card card">
          <h3>🔐 Verify This Bet</h3>
          <div className="fairness-rows">
            <div className="fairness-row"><span>Server Seed Hash</span><code>{result.fairness.serverSeedHashed}</code></div>
            <div className="fairness-row"><span>Client Seed</span><code>{result.fairness.clientSeed}</code></div>
            <div className="fairness-row"><span>Nonce</span><code>{result.fairness.nonce}</code></div>
          </div>
          <p className="fairness-note">Rotate your seeds to reveal the server seed and verify this outcome independently.</p>
        </div>
      )}
    </div>
  );
}
