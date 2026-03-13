import axios from 'axios';
import { useSettingsStore } from '../store/settingsStore';

// Create axios instance with dynamic base URL
const createApiClient = () => {
  const { backendUrl } = useSettingsStore.getState();
  return axios.create({
    baseURL: backendUrl,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

export const api = {
  get: <T>(url: string) => createApiClient().get<T>(url),
  post: <T>(url: string, data?: unknown) => createApiClient().post<T>(url, data),
  delete: <T>(url: string) => createApiClient().delete<T>(url),
};
