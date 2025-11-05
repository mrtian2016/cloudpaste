'use client';

/**
 * 剪贴板图片项组件
 * 通过 API 加载图片，支持自动缓存（Tauri 环境）
 */
import { Loader2 } from 'lucide-react';
import { useImageCache } from '../../hooks/useImageCache';

interface ClipboardImageItemProps {
  fileUrl: string;
  fileName?: string;
  onClick: () => void;
}

export function ClipboardImageItem({ fileUrl, fileName, onClick }: ClipboardImageItemProps) {
  const { imageUrl, isLoading, error } = useImageCache(fileUrl);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full h-48 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className="flex items-center justify-center w-full h-48 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <p className="text-sm text-red-500">图片加载失败</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {fileName || '未知文件'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="cursor-pointer hover:opacity-80 transition-opacity"
      onClick={onClick}
    >
      <img
        src={imageUrl}
        alt={fileName || '图片'}
        className="max-w-xs max-h-48 rounded-lg border border-gray-200 dark:border-gray-700"
      />
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        点击查看大图
      </p>
    </div>
  );
}
