/**
 * API 客户端
 */
import axios, { AxiosInstance, AxiosError } from 'axios';
import { getApiBaseUrl } from './apiConfig';
import type {
  User,
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  UserSettings,
  UserSettingsUpdate,
  ClipboardItem,
  ClipboardItemCreate,
  ClipboardListResponse,
  ClipboardFilter,
  Device,
  DeviceCreate,
  ApiResponse,
  FileUploadResponse
} from '../types';

// 创建 axios 实例
const apiClient: AxiosInstance = axios.create({
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 动态设置 baseURL
apiClient.interceptors.request.use(
  (config) => {
    // 每次请求时动态获取 API 基础 URL
    config.baseURL = getApiBaseUrl();
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 请求拦截器 - 添加 token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理错误
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token 过期或无效，清除本地存储并跳转到登录页
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ==================== 认证 API ====================

export const authApi = {
  /**
   * 用户登录
   */
  async login(data: LoginRequest): Promise<TokenResponse> {
    const formData = new FormData();
    formData.append('username', data.username);
    formData.append('password', data.password);
    
    const response = await apiClient.post<TokenResponse>('/api/v1/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  },

  /**
   * 用户注册
   */
  async register(data: RegisterRequest): Promise<User> {
    const response = await apiClient.post<User>('/api/v1/auth/register', data);
    return response.data;
  },

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<User>('/api/v1/auth/me');
    return response.data;
  },

  /**
   * 更新当前用户信息
   */
  async updateCurrentUser(data: Partial<User>): Promise<User> {
    const response = await apiClient.put<User>('/api/v1/auth/me', data);
    return response.data;
  },

  /**
   * 获取用户设置
   */
  async getUserSettings(): Promise<UserSettings> {
    const response = await apiClient.get<UserSettings>('/api/v1/auth/settings');
    return response.data;
  },

  /**
   * 更新用户设置
   */
  async updateUserSettings(data: UserSettingsUpdate): Promise<UserSettings> {
    const response = await apiClient.put<UserSettings>('/api/v1/auth/settings', data);
    return response.data;
  },
};

// ==================== 剪贴板 API ====================

export const clipboardApi = {
  /**
   * 获取剪贴板列表
   */
  async getList(filter?: ClipboardFilter): Promise<ClipboardListResponse> {
    const response = await apiClient.get<ClipboardListResponse>('/api/v1/clipboard/', {
      params: filter,
    });
    return response.data;
  },

  /**
   * 获取单个剪贴板项
   */
  async getItem(id: number): Promise<ClipboardItem> {
    const response = await apiClient.get<ClipboardItem>(`/api/v1/clipboard/${id}`);
    return response.data;
  },

  /**
   * 创建剪贴板项
   */
  async create(data: ClipboardItemCreate): Promise<ClipboardItem> {
    const response = await apiClient.post<ClipboardItem>('/api/v1/clipboard/', data);
    return response.data;
  },

  /**
   * 更新剪贴板项
   */
  async update(id: number, data: Partial<ClipboardItem>): Promise<ClipboardItem> {
    const response = await apiClient.put<ClipboardItem>(`/api/v1/clipboard/${id}`, data);
    return response.data;
  },

  /**
   * 删除剪贴板项
   */
  async delete(id: number): Promise<ApiResponse> {
    const response = await apiClient.delete<ApiResponse>(`/api/v1/clipboard/${id}`);
    return response.data;
  },

  /**
   * 批量删除剪贴板项
   */
  async batchDelete(ids: number[]): Promise<ApiResponse> {
    const response = await apiClient.delete<ApiResponse>('/api/v1/clipboard/', {
      data: ids,
    });
    return response.data;
  },
};

// ==================== 设备 API ====================

export const deviceApi = {
  /**
   * 获取设备列表
   */
  async getList(): Promise<Device[]> {
    const response = await apiClient.get<Device[]>('/api/v1/devices/');
    return response.data;
  },

  /**
   * 获取设备详情
   */
  async getDevice(deviceId: string): Promise<Device> {
    const response = await apiClient.get<Device>(`/api/v1/devices/${deviceId}`);
    return response.data;
  },

  /**
   * 注册设备
   */
  async register(data: DeviceCreate): Promise<Device> {
    const response = await apiClient.post<Device>('/api/v1/devices/', data);
    return response.data;
  },

  /**
   * 删除设备
   */
  async delete(deviceId: string): Promise<ApiResponse> {
    const response = await apiClient.delete<ApiResponse>(`/api/v1/devices/${deviceId}`);
    return response.data;
  },
};

// ==================== 文件 API ====================

export const fileApi = {
  /**
   * 上传文件
   */
  async upload(file: File, deviceId?: string): Promise<FileUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (deviceId) {
      formData.append('device_id', deviceId);
    }

    const response = await apiClient.post<FileUploadResponse>('/api/v1/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * 获取文件下载 URL
   */
  getDownloadUrl(fileId: string): string {
    return `${getApiBaseUrl()}/api/v1/files/download/${fileId}`;
  },

  /**
   * 删除文件
   */
  async delete(fileId: string): Promise<ApiResponse> {
    const response = await apiClient.delete<ApiResponse>(`/api/v1/files/delete/${fileId}`);
    return response.data;
  },

  /**
   * 获取文件信息
   */
  async getInfo(fileId: string): Promise<ApiResponse> {
    const response = await apiClient.get<ApiResponse>(`/api/v1/files/info/${fileId}`);
    return response.data;
  },

  /**
   * 获取文件文本内容 (用于预览)
   */
  async getTextContent(fileId: string): Promise<string> {
    const response = await apiClient.get(`/api/v1/files/download/${fileId}`, {
      responseType: 'text',
    });
    return response.data;
  },
};

export default apiClient;
