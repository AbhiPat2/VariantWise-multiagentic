// utils/api.js
import axios from 'axios';

export const getCurrentUser = async () => {
  try {
    const res = await axios.get('http://localhost:3001/api/me', {
      withCredentials: true,
    });
    return res.data.user;
  } catch (err) {
    return null;
  }
};
