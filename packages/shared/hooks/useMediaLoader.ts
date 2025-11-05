/**
 * 媒体文件加载 Hook
 * - 视频文件：直接返回 API URL（带认证 token），利用浏览器原生流式播放（支持 Range 请求）
 * - 图片文件：转换为 Blob URL（可选，也可以直接用 API URL）
 */
import { useState, useEffect } from 'react';
import { fetchImageAsBlob, revokeBlobUrl } from '../lib/imageUtils';
import { getApiBaseUrl } from '../lib/apiConfig';

/**
 * 判断是否为视频文件
 */
function isStreamFuke(url: string): boolean {
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.m4v', '.mp3'];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowerUrl.includes(ext));
}

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

export function useMediaLoader(fileUrl: string | null) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!fileUrl) {
      setMediaUrl(null);
      return;
    }

    let isMounted = true;
    let blobUrl: string | null = null;

    const loadMedia = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // 对于视频文件，直接使用 API URL，让浏览器处理流式加载
        // 这样可以支持 Range 请求，实现真正的流式播放
        if (isStreamFuke(fileUrl)) {
          if (isMounted) {
            // 构建完整的 API URL
            let apiUrl = fileUrl.startsWith('http')
              ? fileUrl
              : `${getApiBaseUrl()}${fileUrl}`;

            // 为视频 URL 添加认证 token 参数
            apiUrl = addAuthTokenToUrl(apiUrl);

            setMediaUrl(apiUrl);
          }
        } else {
          // 对于图片文件，继续使用 Blob URL 方式
          const url = await fetchImageAsBlob(fileUrl);

          if (isMounted) {
            blobUrl = url;
            setMediaUrl(url);
          } else {
            // 如果组件已卸载，立即释放 Blob URL
            revokeBlobUrl(url);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err as Error);
          setMediaUrl(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadMedia();

    // 清理函数：释放 Blob URL（仅对图片）
    return () => {
      isMounted = false;
      if (blobUrl) {
        revokeBlobUrl(blobUrl);
      }
    };
  }, [fileUrl]);

  return { mediaUrl, isLoading, error };
}
