export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787'
).replace(/\/+$/, '');

export const DEVELOPMENT_USER_ID =
  import.meta.env.VITE_DEVELOPMENT_USER_ID ?? 'manolis-local-dev';
