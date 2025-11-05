/**
 * 媒体文件缓存 Hook（Tauri Desktop）
 * 支持视频和音频文件的缓存和加载
 */
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { getApiBaseUrl } from '@cloudpaste/shared/lib/apiConfig';

/**
 * 从 localStorage 获取 JWT token
 */
function getAuthToken(): string | null {
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

export function useMediaCache(fileUrl: string | null) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!fileUrl) {
      setMediaUrl(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const loadMedia = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // 构建完整的 API URL
        let apiUrl = fileUrl.startsWith('http')
          ? fileUrl
          : `${getApiBaseUrl()}${fileUrl}`;

        // 添加认证 token 参数
        apiUrl = addAuthTokenToUrl(apiUrl);

        // 调用 Rust 命令获取缓存路径
        try {
          const cachedPath = await invoke<string>('get_cached_file_path', {
            url: apiUrl,
          });

          // 如果返回的是文件系统路径，转换为 Tauri 资产 URL
          if (cachedPath.startsWith('/') || cachedPath.includes(':\\')) {
            const assetUrl = convertFileSrc(cachedPath);
            setMediaUrl(assetUrl);
          } else {
            // 如果下载失败，返回的是原始 URL
            setMediaUrl(cachedPath);
          }
        } catch (err) {
          console.error('媒体文件缓存失败，使用原始 URL:', err);
          // 缓存失败时使用原始 URL
          setMediaUrl(apiUrl);
        }
      } catch (err) {
        console.error('加载媒体文件失败:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMedia();
  }, [fileUrl]);

  return { mediaUrl, isLoading, error };
}
