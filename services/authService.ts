import axios from 'axios';
import { API_CONFIG } from '../constants/Config';

const BASE_URL = API_CONFIG.BASE_URL;


export const authService = {
  login: async (username, password) => {
    console.log(`[Auth] Attempting login for ${username} at ${BASE_URL}`);

    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    const response = await axios.post(`${BASE_URL}/auth/login`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  register: async (username, password) => {
    console.log(`[Auth] Attempting registration for ${username} at ${BASE_URL}`);
    // FastAPI expects query params for this specific register implementation in auth.py
    const response = await axios.post(`${BASE_URL}/auth/register`, {}, {
      params: { username, password }
    });
    return response.data;
  }
};
