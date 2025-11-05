/**
 * Tauri 文件操作工具函数
 */
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { getApiBaseUrl } from '@cloudpaste/shared/lib/apiConfig';

/**
 * 获取认证 token
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

/**
 * 从 URL 中提取文件名
 */
function extractFileName(url: string, defaultName: string = 'download'): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const segments = pathname.split('/');
    const lastSegment = segments[segments.length - 1];

    if (lastSegment && lastSegment.includes('.')) {
      return decodeURIComponent(lastSegment);
    }
  } catch (e) {
    // URL 解析失败，使用默认名称
  }

  return defaultName;
}

/**
 * 从文件名中提取扩展名
 */
function getFileExtension(fileName: string): string | null {
  const parts = fileName.split('.');
  if (parts.length > 1) {
    return parts[parts.length - 1].toLowerCase();
  }
  return null;
}

/**
 * 根据文件扩展名获取过滤器配置
 */
function getFileFilters(fileName: string) {
  const ext = getFileExtension(fileName);

  if (!ext) {
    return undefined; // 没有扩展名，不设置过滤器
  }

  // 根据扩展名返回对应的过滤器
  const filterMap: Record<string, { name: string; extensions: string[] }> = {
    // 图片
    'png': { name: 'PNG 图片', extensions: ['png'] },
    'jpg': { name: 'JPEG 图片', extensions: ['jpg', 'jpeg'] },
    'jpeg': { name: 'JPEG 图片', extensions: ['jpg', 'jpeg'] },
    'gif': { name: 'GIF 图片', extensions: ['gif'] },
    'webp': { name: 'WebP 图片', extensions: ['webp'] },
    'bmp': { name: 'BMP 图片', extensions: ['bmp'] },
    'svg': { name: 'SVG 图片', extensions: ['svg'] },

    // 视频
    'mp4': { name: 'MP4 视频', extensions: ['mp4'] },
    'avi': { name: 'AVI 视频', extensions: ['avi'] },
    'mov': { name: 'MOV 视频', extensions: ['mov'] },
    'mkv': { name: 'MKV 视频', extensions: ['mkv'] },
    'webm': { name: 'WebM 视频', extensions: ['webm'] },

    // 音频
    'mp3': { name: 'MP3 音频', extensions: ['mp3'] },
    'wav': { name: 'WAV 音频', extensions: ['wav'] },
    'ogg': { name: 'OGG 音频', extensions: ['ogg'] },
    'flac': { name: 'FLAC 音频', extensions: ['flac'] },
    'm4a': { name: 'M4A 音频', extensions: ['m4a'] },

    // 文档
    'pdf': { name: 'PDF 文档', extensions: ['pdf'] },
    'txt': { name: '文本文件', extensions: ['txt'] },
    'doc': { name: 'Word 文档', extensions: ['doc'] },
    'docx': { name: 'Word 文档', extensions: ['docx'] },
    'xls': { name: 'Excel 表格', extensions: ['xls'] },
    'xlsx': { name: 'Excel 表格', extensions: ['xlsx'] },
    'ppt': { name: 'PowerPoint 演示', extensions: ['ppt'] },
    'pptx': { name: 'PowerPoint 演示', extensions: ['pptx'] },

    // 压缩文件
    'zip': { name: 'ZIP 压缩包', extensions: ['zip'] },
    'rar': { name: 'RAR 压缩包', extensions: ['rar'] },
    '7z': { name: '7Z 压缩包', extensions: ['7z'] },
    'tar': { name: 'TAR 归档', extensions: ['tar'] },
    'gz': { name: 'GZ 压缩包', extensions: ['gz'] },
  };

  return filterMap[ext] ? [filterMap[ext]] : undefined;
}

/**
 * Tauri 原生文件下载（使用系统保存对话框）
 * 所有文件优先从缓存读取，缓存未命中则从网络下载
 */
export async function downloadFileNative(fileUrl: string, fileName?: string): Promise<void> {
  try {
    // 构建完整的 API URL
    let apiUrl = fileUrl.startsWith('http')
      ? fileUrl
      : `${getApiBaseUrl()}${fileUrl}`;

    // 添加认证 token 参数
    apiUrl = addAuthTokenToUrl(apiUrl);

    // 获取建议的文件名
    const suggestedFileName = fileName || extractFileName(apiUrl, 'download');

    // 根据文件类型获取过滤器
    const filters = getFileFilters(suggestedFileName);

    // 打开系统保存对话框
    const filePath = await save({
      defaultPath: suggestedFileName,
      filters: filters,
    });

    // 用户取消了保存
    if (!filePath) {
      return;
    }

    let fileData: Uint8Array;

    // 尝试从缓存获取文件
    try {
      console.log('📦 尝试从缓存获取文件...');
      const cachedPath = await invoke<string>('get_cached_file_path', {
        url: apiUrl,
      });

      // 如果返回的是文件系统路径，说明缓存命中或已下载
      if (cachedPath.startsWith('/') || cachedPath.includes(':\\')) {
        console.log('✅ 从缓存读取:', cachedPath);
        // 从缓存文件读取数据
        const cachedData = await invoke<number[]>('read_file_bytes', {
          filePath: cachedPath,
        });
        fileData = new Uint8Array(cachedData);
      } else {
        // 缓存失败，从网络下载
        console.log('📥 缓存失败，从网络下载...');
        fileData = await downloadFromNetwork(apiUrl);
      }
    } catch (err) {
      console.warn('从缓存读取失败，从网络下载:', err);
      fileData = await downloadFromNetwork(apiUrl);
    }

    // 保存到用户选择的位置
    await invoke('save_file_to_path', {
      filePath: filePath,
      data: Array.from(fileData),
    });

    console.log('✅ 文件已保存到:', filePath);
  } catch (error) {
    console.error('下载文件失败:', error);
    throw error;
  }
}

/**
 * 从网络下载文件
 */
async function downloadFromNetwork(url: string): Promise<Uint8Array> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`下载失败: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * 批量下载文件（Tauri 原生）
 */
export async function downloadMultipleFilesNative(
  files: Array<{ url: string; name?: string }>
): Promise<void> {
  for (const file of files) {
    try {
      await downloadFileNative(file.url, file.name);
    } catch (error) {
      console.error(`下载文件 ${file.name || file.url} 失败:`, error);
      // 继续下载其他文件
    }
  }
}
