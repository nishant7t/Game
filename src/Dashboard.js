import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import './Dashboard.css';

const GAMES = [
  { to: '/dice', emoji: '🎲', name: 'Dice', desc: 'Pick your win chance. Adjust the multiplier. Roll.', edge: '1% house edge' },
  { to: '/limbo', emoji: '🚀', name: 'Limbo', desc: 'Set a target multiplier. How high can it go?', edge: '1% house edge' },
  { to: '/coinflip', emoji: '🪙', name: 'Coinflip', desc: 'Heads or tails. Classic 50/50 with 1.98x payout.', edge: '1% house edge' },
];

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="dashboard">
      <div className="dashboard-hero">
        <h1>Welcome back, <span className="accent">{user?.username}</span></h1>
        <p>All games are provably fair. Every outcome is verifiable.</p>
      </div>

      {/* Stats row */}
      <div className="stats-row">
        <div className="stat-card card">
          <div className="stat-label">Balance</div>
          <div className="stat-value gold">⚡ {user?.balance?.toLocaleString()}</div>
        </div>
        <div className="stat-card card">
          <div className="stat-label">Total Bets</div>
          <div className="stat-value">{user?.totalBets?.toLocaleString() || 0}</div>
        </div>
        <div className="stat-card card">
          <div className="stat-label">Total Wagered</div>
          <div className="stat-value">{user?.totalWagered?.toLocaleString() || 0}</div>
        </div>
        <div className="stat-card card">
          <div className="stat-label">Net Profit</div>
          <div className={`stat-value ${user?.totalProfit >= 0 ? 'green' : 'red'}`}>
            {user?.totalProfit >= 0 ? '+' : ''}{(user?.totalProfit || 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Game cards */}
      <h2 className="section-title">Choose a Game</h2>
      <div className="game-grid">
        {GAMES.map((game) => (
          <Link to={game.to} key={game.to} className="game-card card">
            <div className="game-emoji">{game.emoji}</div>
            <h3>{game.name}</h3>
            <p>{game.desc}</p>
            <span className="game-edge">{game.edge}</span>
          </Link>
        ))}
      </div>

      {/* Provably fair info */}
      <div className="fair-info card">
        <h3>🔐 Provably Fair</h3>
        <p>
          Every bet uses <strong>HMAC-SHA256</strong> combining a server seed, your client seed,
          and a nonce. The server seed is hashed before each bet — you can verify any outcome
          after rotating your seeds. No bet can be manipulated.
        </p>
        <div className="seed-display">
          <div className="seed-row">
            <span className="seed-label">Server Seed Hash</span>
            <code>{user?.serverSeedHashed?.slice(0, 32)}…</code>
          </div>
          <div className="seed-row">
            <span className="seed-label">Client Seed</span>
            <code>{user?.clientSeed}</code>
          </div>
          <div className="seed-row">
            <span className="seed-label">Current Nonce</span>
            <code>{user?.nonce}</code>
          </div>
        </div>
        <Link to="/history" className="btn btn-outline" style={{ marginTop: 16 }}>
          View & Verify Bets →
        </Link>
      </div>
    </div>
  );
}
