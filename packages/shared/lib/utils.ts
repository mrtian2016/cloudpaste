/**
 * 工具函数
 */
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 合并 Tailwind CSS 类名
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 格式化日期
 * @param date - 日期字符串或 Date 对象（假设字符串是 UTC 时间）
 */
export function formatDate(date: string | Date): string {
  let d: Date;

  if (typeof date === 'string') {
    // 如果没有时区标识，添加 'Z' 表示 UTC 时间
    const dateStr = date.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(date)
      ? date
      : date + 'Z';
    d = new Date(dateStr);
  } else {
    d = date;
  }

  const now = new Date();
  const diff = now.getTime() - d.getTime();
  
  // 小于 1 分钟
  if (diff < 60 * 1000) {
    return '刚刚';
  }
  
  // 小于 1 小时
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000));
    return `${minutes} 分钟前`;
  }
  
  // 小于 24 小时
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours} 小时前`;
  }
  
  // 小于 7 天
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    return `${days} 天前`;
  }
  
  // 格式化为日期
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * 截断文本
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * 生成设备 ID
 */
export function generateDeviceId(): string {
  const stored = localStorage.getItem('device_id');
  if (stored) return stored;
  
  const deviceId = `web_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  localStorage.setItem('device_id', deviceId);
  return deviceId;
}

/**
 * 获取设备名称
 */
export function getDeviceName(): string {
  const stored = localStorage.getItem('device_name');
  if (stored) return stored;
  
  const platform = navigator.platform || 'Unknown';
  const deviceName = `浏览器 (${platform})`;
  localStorage.setItem('device_name', deviceName);
  return deviceName;
}

/**
 * 复制到剪贴板
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // 降级方案
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
        textArea.remove();
        return true;
      } catch (err) {
        textArea.remove();
        return false;
      }
    }
  } catch (err) {
    console.error('复制失败:', err);
    return false;
  }
}

/**
 * 高亮搜索文本
 */
export function highlightText(text: string, search: string): string {
  if (!search) return text;

  const regex = new RegExp(`(${search})`, 'gi');
  return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800">$1</mark>');
}

/**
 * 判断文件是否是可预览的文本类型
 */
export function isPreviewableTextFile(fileName?: string, mimeType?: string): boolean {
  if (!fileName && !mimeType) return false;

  // 通过 MIME 类型判断
  if (mimeType) {
    if (mimeType.startsWith('text/')) return true;
    if (mimeType === 'application/json') return true;
    if (mimeType === 'application/xml') return true;
    if (mimeType === 'application/javascript') return true;
    if (mimeType === 'application/typescript') return true;
  }

  // 通过文件扩展名判断
  if (fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const textExtensions = [
      'txt', 'md', 'json', 'xml', 'csv', 'log', 'yaml', 'yml',
      'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'scss', 'less',
      'py', 'java', 'c', 'cpp', 'h', 'hpp', 'go', 'rs', 'php',
      'rb', 'sh', 'bash', 'sql', 'ini', 'conf', 'config',
      'gitignore', 'env', 'properties', 'toml'
    ];
    return ext ? textExtensions.includes(ext) : false;
  }

  return false;
}

/**
 * 判断文件是否是可预览的音频类型
 */
export function isPreviewableAudioFile(fileName?: string, mimeType?: string): boolean {
  if (!fileName && !mimeType) return false;

  // 通过 MIME 类型判断
  if (mimeType && mimeType.startsWith('audio/')) return true;

  // 通过文件扩展名判断
  if (fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const audioExtensions = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac', 'wma'];
    return ext ? audioExtensions.includes(ext) : false;
  }

  return false;
}

/**
 * 判断文件是否是可预览的视频类型
 */
export function isPreviewableVideoFile(fileName?: string, mimeType?: string): boolean {
  if (!fileName && !mimeType) return false;

  // 通过 MIME 类型判断
  if (mimeType && mimeType.startsWith('video/')) return true;

  // 通过文件扩展名判断
  if (fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const videoExtensions = ['mp4', 'webm', 'ogg', 'avi', 'mov', 'wmv', 'flv', 'mkv'];
    return ext ? videoExtensions.includes(ext) : false;
  }

  return false;
}

/**
 * 判断文件是否是可预览的媒体类型 (音频或视频)
 */
export function isPreviewableMediaFile(fileName?: string, mimeType?: string): boolean {
  return isPreviewableAudioFile(fileName, mimeType) || isPreviewableVideoFile(fileName, mimeType);
}

/**
 * 获取媒体类型
 */
export function getMediaType(fileName?: string, mimeType?: string): 'audio' | 'video' | null {
  if (isPreviewableAudioFile(fileName, mimeType)) return 'audio';
  if (isPreviewableVideoFile(fileName, mimeType)) return 'video';
  return null;
}
