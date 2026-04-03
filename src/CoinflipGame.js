import React, { useState } from 'react';
import { playCoinflip } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import './Game.css';

export default function CoinflipGame() {
  const { user, updateBalance } = useAuth();
  const [betAmount, setBetAmount] = useState(10);
  const [side, setSide] = useState('heads');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [flash, setFlash] = useState(null);
  const [error, setError] = useState('');
  const [flipping, setFlipping] = useState(false);

  const handleBet = async () => {
    setError('');
    if (betAmount < 1) return setError('Minimum bet is 1');
    if (betAmount > user.balance) return setError('Insufficient balance');

    setLoading(true);
    setFlipping(true);
    setResult(null);

    try {
      const res = await playCoinflip(betAmount, side);
      const data = res.data;

      setTimeout(() => {
        setResult(data);
        updateBalance(data.newBalance);
        triggerFlash(data.won ? 'win' : 'loss');
        setFlipping(false);
        setLoading(false);
      }, 800);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Bet failed');
      setFlipping(false);
      setLoading(false);
    }
  };

  const triggerFlash = (type) => {
    setFlash(type);
    setTimeout(() => setFlash(null), 1300);
  };

  const quickBet = (fn) => setBetAmount((prev) => Math.max(1, Math.min(fn(parseFloat(prev)), user.balance)));

  return (
    <div className="game-page">
      {flash && (
        <div className={`result-overlay ${flash}`}>
          {flash === 'win' ? '🎉 WIN!' : '💀 LOSS'}
        </div>
      )}

      <h1 className="game-title">🪙 Coinflip</h1>
      <p className="game-subtitle">
        Classic 50/50. Pick heads or tails. Win 1.98× your bet. House edge: 1%.
      </p>

      {/* Coin display */}
      <div className={`coin-container card ${flipping ? 'flipping' : ''} ${result ? (result.won ? 'won' : 'lost') : ''}`}>
        <div className={`coin ${flipping ? 'spin' : ''}`}>
          {flipping ? '🪙' : result
            ? (result.resultSide === 'heads' ? '😀' : '🦅')
            : (side === 'heads' ? '😀' : '🦅')}
        </div>
        {result && !flipping && (
          <>
            <div className="coin-result-side">
              {result.resultSide === 'heads' ? 'HEADS' : 'TAILS'}
            </div>
            <div className={`roll-verdict ${result.won ? 'green' : 'red'}`}>
              {result.won ? `+${result.profit.toFixed(2)} ⚡` : `-${betAmount} ⚡`}
            </div>
          </>
        )}
      </div>

      {/* Controls */}
      <div className="card game-controls">
        {/* Side selector */}
        <div className="form-group">
          <label>Choose Side</label>
          <div className="side-selector">
            <button
              className={`side-btn ${side === 'heads' ? 'active' : ''}`}
              onClick={() => setSide('heads')}
              disabled={loading}
            >
              😀 Heads
            </button>
            <button
              className={`side-btn ${side === 'tails' ? 'active' : ''}`}
              onClick={() => setSide('tails')}
              disabled={loading}
            >
              🦅 Tails
            </button>
          </div>
        </div>

        <div className="stats-mini">
          <div className="stat-mini"><span>Win Chance</span><strong className="accent">49.5%</strong></div>
          <div className="stat-mini"><span>Multiplier</span><strong className="accent">1.98×</strong></div>
          <div className="stat-mini">
            <span>Profit on Win</span>
            <strong className="green">+{(betAmount * 0.98).toFixed(2)}</strong>
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
          {loading ? 'Flipping...' : `🪙 Flip — Bet ${betAmount} ⚡`}
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
          <p className="fairness-note">Rotate seeds to reveal the server seed and verify this bet independently.</p>
        </div>
      )}
    </div>
  );
}
