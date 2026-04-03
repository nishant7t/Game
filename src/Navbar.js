import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navLinks = [
    { to: '/dashboard', label: '🏠 Dashboard' },
    { to: '/dice', label: '🎲 Dice' },
    { to: '/limbo', label: '🚀 Limbo' },
    { to: '/coinflip', label: '🪙 Coinflip' },
    { to: '/history', label: '📋 History' },
  ];

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/dashboard">⚡ FairGames</Link>
      </div>
      <div className="navbar-links">
        {navLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={location.pathname === link.to ? 'active' : ''}
          >
            {link.label}
          </Link>
        ))}
      </div>
      <div className="navbar-right">
        <span className="balance">
          <span className="balance-label">Balance</span>
          <span className="balance-value">⚡ {user?.balance?.toLocaleString()}</span>
        </span>
        <button className="btn btn-outline btn-sm" onClick={logout}>
          Logout
        </button>
      </div>
    </nav>
  );
}
