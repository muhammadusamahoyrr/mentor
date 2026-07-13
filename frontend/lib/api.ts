import axios from 'axios';

// Axios instance — all requests go through the Next.js BFF proxy (same origin).
// This ensures cookies are forwarded correctly and backend service URLs are
// never exposed to the browser in production.
const api = axios.create({
  baseURL: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

export default api;
