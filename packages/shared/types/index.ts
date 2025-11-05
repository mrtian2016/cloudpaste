/**
 * 类型定义
 */

// ==================== 用户相关 ====================
export interface User {
  id: number;
  username: string;
  email?: string;
  full_name?: string;
  is_active: boolean;
  is_superuser: boolean;
  max_history_items: number;
  created_at: string;
  last_login?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  email?: string;
  full_name?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserSettings {
  max_history_items: number;
}

export interface UserSettingsUpdate {
  max_history_items?: number;
}

// ==================== 剪贴板相关 ====================
export interface ClipboardItem {
  id: number;
  content: string;
  content_type: 'text' | 'image' | 'file';
  device_id?: string;
  device_name?: string;
  favorite: boolean;
  tags?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  updated_at: string;
  synced: boolean;
}

export interface ClipboardItemCreate {
  content: string;
  content_type: 'text' | 'image' | 'file';
  device_id?: string;
  device_name?: string;
  favorite?: boolean;
  tags?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
}

export interface ClipboardListResponse {
  total: number;
  page: number;
  page_size: number;
  items: ClipboardItem[];
}

export interface ClipboardFilter {
  page?: number;
  page_size?: number;
  device_id?: string;
  favorite?: boolean;
  search?: string;
}

// ==================== 设备相关 ====================
export interface Device {
  id: number;
  device_id: string;
  device_name: string;
  device_type?: string;
  last_sync?: string;
  created_at: string;
}

export interface DeviceCreate {
  device_id: string;
  device_name: string;
  device_type?: string;
}

// ==================== WebSocket 相关 ====================
export interface WebSocketMessage {
  type: 'connected' | 'clipboard_sync' | 'sync_confirmed' | 'sync_skipped' |
        'device_offline' | 'device_online' | 'online_devices' | 'pong' | 'error' | 'timestamp_updated';
  data: any;
}

export interface ClipboardSyncData {
  content: string;
  content_type: 'text' | 'image' | 'file';
  device_id?: string;
  device_name?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  file_id?: string;
  file_url?: string;
  clipboard_id?: number;
}

export interface OnlineDevice {
  device_id: string;
  device_name?: string;
  connected_at: string;
}

// ==================== API 响应 ====================
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

// ==================== 文件上传 ====================
export interface FileUploadResponse {
  success: boolean;
  data: {
    file_id: string;
    file_name: string;
    file_size: number;
    mime_type: string;
    file_url: string;
    content_type: 'image' | 'file';
  };
}
