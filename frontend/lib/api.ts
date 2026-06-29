import axios from 'axios';

// Axios instance demonstrating the HTTP API calling pattern (Week 1 topic: fetch / axios, error handling)
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' },
});

export default api;
