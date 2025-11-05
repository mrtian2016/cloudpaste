/**
 * 图片处理工具函数
 */
import apiClient from './api';
import { getApiBaseUrl } from './apiConfig';

/**
 * 从文件 URL 中提取文件 ID
 */
export function extractFileId(fileUrl: string): string | null {
  // URL 格式: /api/v1/files/download/{file_id}
  const match = fileUrl.match(/\/api\/v1\/files\/download\/([^/?]+)/);
  return match ? match[1] : null;
}

/**
 * 通过 API 获取图片并转换为 Blob URL
 */
export async function fetchImageAsBlob(fileUrl: string): Promise<string> {
  try {
    const fileId = extractFileId(fileUrl);
    
    if (!fileId) {
      // 如果不是 API URL，直接返回原 URL
      return fileUrl;
    }

    // 通过 API 下载图片
    const response = await apiClient.get(`/api/v1/files/download/${fileId}`, {
      responseType: 'blob',
    });

    // 创建 Blob URL
    const blob = new Blob([response.data], { type: response.headers['content-type'] });
    const blobUrl = URL.createObjectURL(blob);

    return blobUrl;
  } catch (error) {
    console.error('获取图片失败:', error);
    // 失败时返回原 URL
    return fileUrl;
  }
}

/**
 * 释放 Blob URL
 */
export function revokeBlobUrl(blobUrl: string) {
  if (blobUrl.startsWith('blob:')) {
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * 获取认证 token
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

/**
 * 下载文件（优化版：直接触发浏览器下载，不占用内存）
 */
export async function downloadFile(fileUrl: string, fileName?: string) {
  try {
    let downloadUrl: string;

    // 如果是完整的 URL（以 http 开头），直接使用
    if (fileUrl.startsWith('http')) {
      // 添加 download 参数
      const separator = fileUrl.includes('?') ? '&' : '?';
      downloadUrl = `${fileUrl}${separator}download=true`;
    } else {
      // 兼容旧的相对路径格式
      const fileId = extractFileId(fileUrl);

      if (!fileId) {
        // 如果不是 API URL，直接打开
        window.open(fileUrl, '_blank');
        return;
      }

      // 构建下载 URL（带认证 token 和 download 参数）
      const API_BASE_URL = getApiBaseUrl();
      downloadUrl = `${API_BASE_URL}/api/v1/files/download/${fileId}?download=true`;
    }

    // 添加认证 token 参数
    downloadUrl = addAuthTokenToUrl(downloadUrl);

    // 创建临时下载链接并触发下载
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName || 'download';
    link.target = '_blank'; // 作为备用，如果 download 属性不生效

    // 添加到 DOM，触发点击，然后移除
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('下载文件失败:', error);
    throw error;
  }
}
