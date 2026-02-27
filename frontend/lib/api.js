import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001",
  withCredentials: true
});

export const login = async (credentials) => {
  const response = await api.post('/api/login', credentials);
  return response.data;
};

// Add more API functions as needed