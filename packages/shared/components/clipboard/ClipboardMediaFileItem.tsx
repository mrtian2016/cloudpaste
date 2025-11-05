'use client';

/**
 * 剪贴板媒体文件项组件
 * 只显示文件信息，不自动加载
 */
import { Music, Video } from 'lucide-react';

interface ClipboardMediaFileItemProps {
  fileName?: string;
  fileSize?: number;
  mediaType: 'audio' | 'video';
  onClick: () => void;
}

export function ClipboardMediaFileItem({
  fileName,
  fileSize,
  mediaType,
  onClick
}: ClipboardMediaFileItemProps) {
  const MediaIcon = mediaType === 'audio' ? Music : Video;
  const mediaTypeText = mediaType === 'audio' ? '音频' : '视频';

  return (
    <div
      className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-200 dark:border-purple-700 cursor-pointer hover:from-purple-100 hover:to-pink-100 dark:hover:from-purple-900/30 dark:hover:to-pink-900/30 transition-all"
      onClick={onClick}
    >
      <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
        <MediaIcon className="w-6 h-6 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-gray-900 dark:text-white font-medium truncate">
          {fileName || `未知${mediaTypeText}`}
        </p>
        {fileSize && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {(fileSize / 1024 / 1024).toFixed(2)} MB
          </p>
        )}
        <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">
          点击播放{mediaTypeText}
        </p>
      </div>
    </div>
  );
}
