/**
 * API 配置管理
 *
 * 支持多种部署模式：
 * 1. Webapp（Nginx 反向代理）：前后端同域，使用相对路径，无需配置
 * 2. Desktop App（Tauri）：用户通过设置界面配置服务器地址（存储在 localStorage）
 * 3. 开发模式：localhost 开发时，默认使用 http://localhost:8000
 * 4. 构建时指定：通过环境变量 NEXT_PUBLIC_API_URL 固定服务器地址
 */

const API_BASE_URL_KEY = 'api_base_url';
const DEFAULT_DEV_API_URL = '';

/**
 * 检测是否为 Tauri Desktop App
 */
export function isTauriApp(): boolean {
  if (typeof window === 'undefined') return false;
  // Tauri 应用会有 __TAURI__ 全局对象
  return '__TAURI_OS_PLUGIN_INTERNALS__' in window;
}

/**
 * 获取 API 基础 URL
 *
 * 优先级：
 * 1. localStorage 配置（Desktop App 用户设置，最高优先级）
 * 2. 环境变量 NEXT_PUBLIC_API_URL（构建时指定）
 * 3. 开发环境：http://localhost:8000
 * 4. Webapp 生产环境：空字符串（相对路径，nginx 反向代理）
 * 5. Desktop App 未配置：提示用户配置
 */
export function getApiBaseUrl(): string {
  // 服务端渲染时的默认值
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || '';
  }

  // 1. 优先从 localStorage 读取（Desktop App 用户配置）
  const storedUrl = localStorage.getItem(API_BASE_URL_KEY);
  if (storedUrl) {
    return storedUrl;
  }

  // 2. 其次使用环境变量（构建时配置）
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // 3. 开发环境检测
  const { hostname, protocol } = window.location;
  const isDev = hostname === 'localhost' || hostname === '127.0.0.1';

  if (isDev) {
    // 开发环境默认使用 localhost:8000
    return DEFAULT_DEV_API_URL;
  }

  // 4. 检测是否为 Desktop App
  const isDesktop = isTauriApp() || protocol === 'tauri:';

  if (isDesktop) {
    // Desktop App 未配置时，返回空字符串
    // 应用应该引导用户到设置页面配置服务器地址
    console.warn('Desktop App 未配置服务器地址，请前往设置页面配置');
    return '';
  }

  // 5. Webapp 生产环境：使用相对路径（nginx 反向代理）
  return '';
}

/**
 * 设置 API 基础 URL
 */
export function setApiBaseUrl(url: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  // 移除 URL 末尾的斜杠
  const cleanUrl = url.replace(/\/$/, '');
  localStorage.setItem(API_BASE_URL_KEY, cleanUrl);
}

/**
 * 清除 API 基础 URL 配置
 */
export function clearApiBaseUrl(): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem(API_BASE_URL_KEY);
}

/**
 * 检查是否已配置自定义 API URL
 */
export function hasCustomApiUrl(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return !!localStorage.getItem(API_BASE_URL_KEY);
}

/**
 * 获取默认 API URL
 */
export function getDefaultApiUrl(): string {
  return DEFAULT_DEV_API_URL;
}
