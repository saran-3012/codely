import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

// Attach access token to every outgoing request
api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// On 401, try to refresh the access token once then retry
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const { data } = await axios.post(
          '/api/auth/refresh',
          {},
          { withCredentials: true }
        );
        accessToken = data.accessToken;
        setAccessToken(accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch {
        accessToken = null;
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
