/**
 * 图片加载 Hook
 * 直接返回图片 URL（带认证 token），无需下载到内存
 */
import { useState, useEffect } from 'react';
import { getApiBaseUrl } from '../lib/apiConfig';

/**
 * 从 localStorage 获取 JWT token
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

/**
 * 为 URL 添加认证 token 参数
 */
function addAuthTokenToUrl(url: string): string {
  const token = getAuthToken();
  if (!token) return url;

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}token=${encodeURIComponent(token)}`;
}

export function useImageLoader(fileUrl: string | null) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!fileUrl) {
      setImageUrl(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    // 构建完整的 API URL
    let apiUrl = fileUrl.startsWith('http')
      ? fileUrl
      : `${getApiBaseUrl()}${fileUrl}`;

    // 添加认证 token 参数
    apiUrl = addAuthTokenToUrl(apiUrl);

    setImageUrl(apiUrl);
    setIsLoading(false);
  }, [fileUrl]);

  return { imageUrl, isLoading, error };
}
