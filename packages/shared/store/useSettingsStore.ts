/**
 * 应用设置 Store
 * 管理文件上传过滤规则和大小限制
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UploadSettings {
  /**
   * 是否启用文件大小限制
   */
  enableSizeLimit: boolean;
  
  /**
   * 最大文件大小（MB）
   */
  maxFileSizeMB: number;
  
  /**
   * 是否启用文件类型过滤
   */
  enableFileTypeFilter: boolean;
  
  /**
   * 允许上传的文件扩展名列表（小写，不含点）
   * 例如: ['jpg', 'png', 'pdf', 'txt']
   */
  allowedExtensions: string[];
  
  /**
   * 是否启用文件名过滤
   */
  enableFileNameFilter: boolean;
  
  /**
   * 文件名过滤规则（正则表达式字符串）
   * 例如: '.*\\.tmp$' 排除临时文件
   */
  fileNameFilterPatterns: string[];
  
  /**
   * 是否自动上传剪贴板内容
   */
  autoUpload: boolean;

  /**
   * 是否自动复制同步的内容到剪贴板
   * 当从其他设备收到同步时，是否自动写入本地剪贴板
   */
  autoCopyToClipboard: boolean;

  /**
   * 历史数据最大保留条数
   * 默认 1000 条
   */
  maxHistoryItems: number;
}

interface SettingsState {
  uploadSettings: UploadSettings;
  
  /**
   * 更新上传设置
   */
  updateUploadSettings: (settings: Partial<UploadSettings>) => void;
  
  /**
   * 重置为默认设置
   */
  resetToDefaults: () => void;
  
  /**
   * 检查文件是否应该上传
   */
  shouldUploadFile: (fileName: string, fileSizeBytes: number) => {
    allowed: boolean;
    reason?: string;
  };
}

// 默认设置
const DEFAULT_SETTINGS: UploadSettings = {
  enableSizeLimit: true,
  maxFileSizeMB: 50, // 默认 50MB
  enableFileTypeFilter: false,
  allowedExtensions: [
    // 图片
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico',
    // 文档
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md',
    // 压缩包
    'zip', 'rar', '7z', 'tar', 'gz',
    // 代码
    'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rs',
    // 其他
    'json', 'xml', 'csv', 'html', 'css'
  ],
  enableFileNameFilter: true,
  fileNameFilterPatterns: [
    '.*\\.tmp$',           // 临时文件
    '.*\\.cache$',         // 缓存文件
    '^\\..*',              // 隐藏文件
    '.*~$',                // 备份文件
    '.*\\.log$',           // 日志文件
  ],
  autoUpload: true,
  autoCopyToClipboard: true, // 默认启用自动复制到剪贴板
  maxHistoryItems: 1000, // 默认保留 1000 条
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      uploadSettings: DEFAULT_SETTINGS,

      updateUploadSettings: (settings) => {
        set((state) => ({
          uploadSettings: {
            ...state.uploadSettings,
            ...settings,
          },
        }));
      },

      resetToDefaults: () => {
        set({ uploadSettings: DEFAULT_SETTINGS });
      },
      
      shouldUploadFile: (fileName, fileSizeBytes) => {
        const settings = get().uploadSettings;
        
        // 检查文件大小
        if (settings.enableSizeLimit) {
          const fileSizeMB = fileSizeBytes / (1024 * 1024);
          if (fileSizeMB > settings.maxFileSizeMB) {
            return {
              allowed: false,
              reason: `文件大小 ${fileSizeMB.toFixed(2)}MB 超过限制 ${settings.maxFileSizeMB}MB`,
            };
          }
        }
        
        // 检查文件扩展名
        if (settings.enableFileTypeFilter) {
          const ext = fileName.split('.').pop()?.toLowerCase() || '';
          if (!settings.allowedExtensions.includes(ext)) {
            return {
              allowed: false,
              reason: `文件类型 .${ext} 不在允许列表中`,
            };
          }
        }
        
        // 检查文件名过滤规则
        if (settings.enableFileNameFilter) {
          for (const pattern of settings.fileNameFilterPatterns) {
            try {
              const regex = new RegExp(pattern);
              if (regex.test(fileName)) {
                return {
                  allowed: false,
                  reason: `文件名匹配过滤规则: ${pattern}`,
                };
              }
            } catch (error) {
              console.error('无效的正则表达式:', pattern, error);
            }
          }
        }
        
        return { allowed: true };
      },
    }),
    {
      name: 'cloudpaste-settings',
      // 合并持久化数据和默认设置，确保新增字段有默认值
      merge: (persistedState: any, currentState: SettingsState) => {
        return {
          ...currentState,
          uploadSettings: {
            ...DEFAULT_SETTINGS,
            ...(persistedState as any)?.uploadSettings,
          },
        };
      },
    }
  )
);
