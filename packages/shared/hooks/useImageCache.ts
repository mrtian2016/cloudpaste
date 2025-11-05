/**
 * 图片缓存 Hook（仅 Tauri Desktop）
 * 自动下载并缓存远程图片，加载过的图片从本地读取
 */
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { getApiBaseUrl, isTauriApp } from '../lib/apiConfig';

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

export function useImageCache(fileUrl: string | null) {
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

    const loadImage = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // 构建完整的 API URL
        let apiUrl = fileUrl.startsWith('http')
          ? fileUrl
          : `${getApiBaseUrl()}${fileUrl}`;

        // 添加认证 token 参数
        apiUrl = addAuthTokenToUrl(apiUrl);
        
        // 如果是浏览器环境（非 Tauri），直接使用 API URL
        if (!isTauriApp()) {
          setImageUrl(apiUrl);
          return;
        }

        // 调用 Rust 命令获取缓存路径
        try {
          const cachedPath = await invoke<string>('get_cached_image_path', {
            url: apiUrl,
          });

          // 如果返回的是文件系统路径，转换为 Tauri 资产 URL
          if (cachedPath.startsWith('/') || cachedPath.includes(':\\')) {
            const assetUrl = convertFileSrc(cachedPath);
            setImageUrl(assetUrl);
          } else {
            // 如果下载失败，返回的是原始 URL
            setImageUrl(cachedPath);
          }
        } catch (err) {
          console.error('图片缓存失败，使用原始 URL:', err);
          // 缓存失败时使用原始 URL
          setImageUrl(apiUrl);
        }
      } catch (err) {
        console.error('加载图片失败:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    loadImage();
  }, [fileUrl]);

  return { imageUrl, isLoading, error };
}

/**
 * 清除所有图片缓存
 */
export async function clearImageCache(): Promise<void> {
  try {
    await invoke('clear_image_cache');
    console.log('✅ 图片缓存已清除');
  } catch (err) {
    console.error('清除缓存失败:', err);
    throw err;
  }
}

/**
 * 获取缓存大小（字节）
 */
export async function getCacheSize(): Promise<number> {
  try {
    const size = await invoke<number>('get_cache_size');
    return size;
  } catch (err) {
    console.error('获取缓存大小失败:', err);
    throw err;
  }
}
