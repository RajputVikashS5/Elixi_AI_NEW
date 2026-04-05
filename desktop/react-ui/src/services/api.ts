import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { useSettingsStore } from '../store/settingsStore';

/**
 * Get the base URL for API calls.
 * Priority: settings store > env variable > fallback
 */
const getBaseUrl = (): string => {
  try {
    const { backendUrl } = useSettingsStore.getState();
    if (backendUrl && backendUrl !== '') {
      return backendUrl;
    }
  } catch {
    // Fallback if store unavailable
  }
  
  // Use environment variable or fallback to 127.0.0.1
  return import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001';
};

/**
 * Get the AI engine base URL.
 */
const getAiEngineUrl = (): string => {
  return import.meta.env.VITE_AI_ENGINE_URL || 'http://127.0.0.1:8000';
};

let apiClient: AxiosInstance | null = null;

/**
 * Create or get the axios API client.
 * Creates a new instance if base URL changed.
 */
export const createApiClient = (): AxiosInstance => {
  const baseURL = getBaseUrl();
  
  if (apiClient && apiClient.defaults.baseURL === baseURL) {
    return apiClient;
  }

  apiClient = axios.create({
    baseURL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
    withCredentials: true,
  });

  // Add response error logging
  apiClient.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      console.error('[API Error]', {
        status: error.response?.status,
        url: error.config?.url,
        method: error.config?.method,
        message: error.message,
      });
      return Promise.reject(error);
    }
  );

  return apiClient;
};

/**
 * Health check for backend.
 */
export const checkBackendHealth = async (): Promise<boolean> => {
  try {
    const client = createApiClient();
    const response = await client.get('/health', { timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    console.warn('[Backend Health Check] Failed', error);
    return false;
  }
};

/**
 * Health check for AI engine.
 */
export const checkAiEngineHealth = async (): Promise<boolean> => {
  try {
    const aiEngineUrl = getAiEngineUrl();
    const response = await axios.get(`${aiEngineUrl}/health`, { timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    console.warn('[AI Engine Health Check] Failed', error);
    return false;
  }
};

/**
 * Main API interface for making HTTP requests.
 */
export const api = {
  get: <T>(url: string, config?: AxiosRequestConfig) => createApiClient().get<T>(url, config),
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => createApiClient().post<T>(url, data, config),
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => createApiClient().put<T>(url, data, config),
  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => createApiClient().patch<T>(url, data, config),
  delete: <T>(url: string, config?: AxiosRequestConfig) => createApiClient().delete<T>(url, config),
};
