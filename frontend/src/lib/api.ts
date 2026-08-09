import axios from 'axios';
import { supabase } from '../config/supabase';

const API_URL = (import.meta.env.VITE_API_URL as string) || '';

const api = axios.create({
  baseURL: API_URL,
});

// Inject the Supabase JWT on every request
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// Transform API errors into user-friendly messages
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — sign out and reload
      supabase.auth.signOut().then(() => {
        window.location.href = '/login';
      });
    }
    return Promise.reject(error);
  }
);

export default api;
