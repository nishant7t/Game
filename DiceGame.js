import React, { useState } from 'react';
import { playDice } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import './Game.css';

export default function DiceGame() {
  const { user, updateBalance } = useAuth();
  const [betAmount, setBetAmount] = useState(10);
  const [winChance, setWinChance] = useState(50);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [flash, setFlash] = useState(null); // 'win' | 'loss'
  const [error, setError] = useState('');

  const multiplier = ((1 - 0.01) / (winChance / 100)).toFixed(4);
  const potentialProfit = ((betAmount * parseFloat(multiplier)) - betAmount).toFixed(2);

  const handleBet = async () => {
    setError('');
    if (betAmount < 1) return setError('Minimum bet is 1');
    if (betAmount > user.balance) return setError('Insufficient balance');

    setLoading(true);
    setResult(null);
    try {
      const res = await playDice(betAmount, winChance);
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
    setBetAmount((prev) => {
      const next = fn(parseFloat(prev));
      return Math.max(1, Math.min(next, user.balance));
    });
  };

  return (
    <div className="game-page">
      {flash && (
        <div className={`result-overlay ${flash}`}>
          {flash === 'win' ? '🎉 WIN!' : '💀 LOSS'}
        </div>
      )}

      <h1 className="game-title">🎲 Dice</h1>
      <p className="game-subtitle">
        Roll under your target. Higher win chance = lower multiplier. House edge: 1%.
      </p>

      {/* Live roll display */}
      {result && (
        <div className={`roll-display card ${result.won ? 'won' : 'lost'}`}>
          <div className="roll-number">{result.roll.toFixed(2)}</div>
          <div className="roll-target">Target: &lt; {winChance}</div>
          <div className={`roll-verdict ${result.won ? 'green' : 'red'}`}>
            {result.won ? `+${result.profit.toFixed(2)} ⚡` : `-${betAmount} ⚡`}
          </div>
        </div>
      )}

      {/* Dice bar */}
      <div className="dice-bar card">
        <div className="dice-bar-track">
          <div
            className="dice-bar-fill"
            style={{ width: `${winChance}%` }}
          />
          {result && (
            <div
              className={`dice-marker ${result.won ? 'won' : 'lost'}`}
              style={{ left: `${Math.min(result.roll, 99.5)}%` }}
            />
          )}
        </div>
        <div className="dice-bar-labels">
          <span>0</span>
          <span>Win Zone ({winChance}%)</span>
          <span>100</span>
        </div>
      </div>

      {/* Controls */}
      <div className="card game-controls">
        <div className="control-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label>Win Chance: <strong>{winChance}%</strong></label>
            <input
              type="range"
              min={1} max={98} value={winChance}
              onChange={(e) => setWinChance(Number(e.target.value))}
              className="range-input"
            />
          </div>
        </div>

        <div className="stats-mini">
          <div className="stat-mini">
            <span>Multiplier</span>
            <strong className="accent">{multiplier}x</strong>
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

        <button
          className="btn btn-green btn-full bet-btn"
          onClick={handleBet}
          disabled={loading}
        >
          {loading ? 'Rolling...' : `🎲 Roll Dice — Bet ${betAmount} ⚡`}
        </button>
      </div>

      {/* Fairness info */}
      {result && (
        <div className="fairness-card card">
          <h3>🔐 Verify This Bet</h3>
          <div className="fairness-rows">
            <div className="fairness-row">
              <span>Server Seed Hash</span>
              <code>{result.fairness.serverSeedHashed}</code>
            </div>
            <div className="fairness-row">
              <span>Client Seed</span>
              <code>{result.fairness.clientSeed}</code>
            </div>
            <div className="fairness-row">
              <span>Nonce</span>
              <code>{result.fairness.nonce}</code>
            </div>
          </div>
          <p className="fairness-note">
            Rotate your seeds on the dashboard to reveal the server seed and independently verify this outcome.
          </p>
        </div>
      )}
    </div>
  );
}
