import React, { useState, useEffect } from 'react';
import { getHistory, rotateSeeds, verifyBet } from './api';
import { useAuth } from './AuthContext';
import './History.css';

const GAME_EMOJIS = { dice: '🎲', limbo: '🚀', coinflip: '🪙' };

export default function History() {
  const { user, updateUser } = useAuth();
  const [bets, setBets] = useState([]);
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(1);
  const [gameFilter, setGameFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [revealedSeed, setRevealedSeed] = useState(null);
  const [verifying, setVerifying] = useState(null);
  const [verifyResult, setVerifyResult] = useState(null);

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line
  }, [page, gameFilter]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (gameFilter) params.game = gameFilter;
      const res = await getHistory(params);
      setBets(res.data.bets);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRotateSeeds = async () => {
    if (!window.confirm('This will reveal your current server seed (for verification) and generate a new one. Continue?')) return;
    setRotating(true);
    try {
      const res = await rotateSeeds();
      setRevealedSeed(res.data.revealedServerSeed);
      updateUser({ serverSeedHashed: res.data.newServerSeedHashed, nonce: 0 });
      alert(`Seeds rotated! Your revealed server seed:\n\n${res.data.revealedServerSeed}\n\nSave this to verify past bets.`);
    } catch (err) {
      alert('Failed to rotate seeds');
    } finally {
      setRotating(false);
    }
  };

  const handleVerify = async (bet) => {
    if (!bet.serverSeedRevealed) {
      alert('Rotate your seeds first to reveal the server seed for verification.');
      return;
    }
    setVerifying(bet._id);
    try {
      const res = await verifyBet({
        serverSeed: bet.serverSeedRevealed,
        clientSeed: bet.clientSeed,
        nonce: bet.nonce,
        game: bet.game,
        gameParams: bet.gameParams,
      });
      setVerifyResult({ betId: bet._id, data: res.data });
    } catch (err) {
      alert('Verification failed: ' + (err.response?.data?.error || 'Unknown error'));
    } finally {
      setVerifying(null);
    }
  };

  return (
    <div className="history-page">
      <h1>📋 Bet History</h1>
      <p className="page-sub">All bets are provably fair. Rotate seeds to verify past outcomes.</p>

      {/* Seed management */}
      <div className="seed-manager card">
        <h3>🔐 Seed Management</h3>
        <div className="seed-info">
          <div className="seed-row">
            <span>Current Server Seed Hash</span>
            <code>{user?.serverSeedHashed}</code>
          </div>
          <div className="seed-row">
            <span>Client Seed</span>
            <code>{user?.clientSeed}</code>
          </div>
          <div className="seed-row">
            <span>Nonce</span>
            <code>{user?.nonce}</code>
          </div>
          {revealedSeed && (
            <div className="seed-row revealed">
              <span>⚠️ Revealed Server Seed</span>
              <code>{revealedSeed}</code>
            </div>
          )}
        </div>
        <button className="btn btn-outline" onClick={handleRotateSeeds} disabled={rotating}>
          {rotating ? 'Rotating...' : '🔄 Rotate Seeds (reveals current server seed)'}
        </button>
      </div>

      {/* Filters */}
      <div className="history-toolbar">
        <select
          value={gameFilter}
          onChange={(e) => { setGameFilter(e.target.value); setPage(1); }}
          className="filter-select"
        >
          <option value="">All Games</option>
          <option value="dice">🎲 Dice</option>
          <option value="limbo">🚀 Limbo</option>
          <option value="coinflip">🪙 Coinflip</option>
        </select>
        <span className="result-count">
          {pagination.total || 0} total bets
        </span>
      </div>

      {/* Bets table */}
      {loading ? (
        <div className="loading-state">Loading bets...</div>
      ) : bets.length === 0 ? (
        <div className="empty-state card">No bets found. Start playing!</div>
      ) : (
        <div className="bets-list">
          {bets.map((bet) => (
            <div key={bet._id} className={`bet-row-card card ${bet.result.won ? 'won' : 'lost'}`}>
              <div className="bet-left">
                <div className="bet-game">{GAME_EMOJIS[bet.game]} {bet.game}</div>
                <div className="bet-time">{new Date(bet.createdAt).toLocaleString()}</div>
              </div>
              <div className="bet-middle">
                <div className="bet-detail">
                  <span>Bet</span> <strong>{bet.betAmount} ⚡</strong>
                </div>
                <div className="bet-detail">
                  <span>Mult</span>
                  <strong>{bet.result.won ? `${bet.result.multiplier}×` : '0×'}</strong>
                </div>
                <div className="bet-detail">
                  <span>Roll</span>
                  <strong>{typeof bet.result.rawValue === 'number' ? bet.result.rawValue.toFixed(2) : '-'}</strong>
                </div>
              </div>
              <div className="bet-right">
                <span className={`badge ${bet.result.won ? 'badge-win' : 'badge-loss'}`}>
                  {bet.result.won ? 'WIN' : 'LOSS'}
                </span>
                <div className={`bet-profit ${bet.profit >= 0 ? 'green' : 'red'}`}>
                  {bet.profit >= 0 ? '+' : ''}{bet.profit.toFixed(2)} ⚡
                </div>
                <button
                  className="btn btn-outline verify-btn"
                  onClick={() => handleVerify(bet)}
                  disabled={verifying === bet._id}
                  title={bet.serverSeedRevealed ? 'Verify this bet' : 'Rotate seeds first'}
                >
                  {verifying === bet._id ? '...' : bet.serverSeedRevealed ? '✅ Verify' : '🔒 Locked'}
                </button>
              </div>

              {/* Verification result */}
              {verifyResult?.betId === bet._id && (
                <div className="verify-result">
                  <strong>✅ Verification result:</strong> Raw value = {verifyResult.data.result.rawValue?.toFixed(4)},
                  Won = {verifyResult.data.result.won ? 'Yes' : 'No'}.
                  Server seed hash matches: <code>{verifyResult.data.serverSeedHash.slice(0, 20)}…</code>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            ← Prev
          </button>
          <span>Page {page} of {pagination.totalPages}</span>
          <button className="btn btn-outline" disabled={page === pagination.totalPages} onClick={() => setPage(p => p + 1)}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
