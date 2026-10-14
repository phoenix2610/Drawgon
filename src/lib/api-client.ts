import axios from 'axios';

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export function apiErrorMessage(error: unknown, fallback: string): string {
  const message = (
    error as { response?: { data?: { message?: string | string[] } } }
  ).response?.data?.message;
  if (Array.isArray(message)) return message.join(' ');
  return message || fallback;
}
