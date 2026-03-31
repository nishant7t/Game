import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'https://game-yheq.onrender.com/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request automatically
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Global response error handling
API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const register = (data) => API.post('/auth/register', data);
export const login = (data) => API.post('/auth/login', data);

// ─── User ─────────────────────────────────────────────────────────────────────
export const getMe = () => API.get('/user/me');
export const getHistory = (params) => API.get('/user/history', { params });
export const rotateSeeds = () => API.post('/user/seeds/rotate');
export const setClientSeed = (clientSeed) => API.put('/user/seeds/client', { clientSeed });

// ─── Games ────────────────────────────────────────────────────────────────────
export const playDice = (betAmount, winChance) =>
  API.post('/game/dice', { betAmount, winChance });

export const playLimbo = (betAmount, targetMultiplier) =>
  API.post('/game/limbo', { betAmount, targetMultiplier });

export const playCoinflip = (betAmount, side) =>
  API.post('/game/coinflip', { betAmount, side });

export const verifyBet = (data) => API.post('/game/verify', data);

export default API;
