'use client';

/**
 * Desktop 专用媒体预览 Modal（支持缓存）
 */
import { X, Download, Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '@cloudpaste/shared/components/ui/Button';
import { useMediaCache } from '@/lib/hooks/useMediaCache';

interface MediaPreviewModalProps {
  isOpen: boolean;
  fileUrl: string;
  mediaType: 'audio' | 'video';
  fileName?: string;
  onClose: () => void;
  onDownload?: (url: string, fileName?: string) => Promise<void>;
}

export function MediaPreviewModal({
  isOpen,
  fileUrl,
  mediaType,
  fileName,
  onClose,
  onDownload
}: MediaPreviewModalProps) {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);

  // 使用缓存加载媒体文件
  const { mediaUrl, isLoading, error } = useMediaCache(isOpen ? fileUrl : null);

  // ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownload = async () => {
    if (onDownload) {
      await onDownload(fileUrl, fileName);
    }
  };

  const handleClose = () => {
    // 暂停播放
    if (mediaRef.current) {
      if ('pause' in mediaRef.current) {
        mediaRef.current.pause();
      }
    }
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      {/* 主容器 - 响应式 */}
      <div className="relative w-full max-w-4xl max-h-[90vh] m-4 bg-white dark:bg-gray-800 rounded-lg shadow-2xl flex flex-col">
        {/* 工具栏 */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-medium text-base sm:text-lg text-gray-900 dark:text-white truncate flex-1 mr-4">
            {fileName || (mediaType === 'audio' ? '音频播放' : '视频播放')}
          </h3>

          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDownload}
              className="p-1.5 sm:p-2"
              title="下载"
            >
              <Download className="w-4 h-4" />
              <span className="ml-1.5 hidden sm:inline">下载</span>
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={handleClose}
              className="p-1.5 sm:p-2"
              title="关闭"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </div>
        </div>

        {/* 媒体内容区域 */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 bg-gray-50 dark:bg-gray-900">
          {isLoading ? (
            <div className="text-center">
              <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 animate-spin mx-auto text-purple-500 mb-3 sm:mb-4" />
              <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
                正在加载{mediaType === 'audio' ? '音频' : '视频'}...
              </p>
            </div>
          ) : error || !mediaUrl ? (
            <div className="text-center px-4">
              <p className="text-gray-900 dark:text-white text-base sm:text-lg mb-2">
                {mediaType === 'audio' ? '音频' : '视频'}加载失败
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm break-all">
                {fileName || '未知文件'}
              </p>
            </div>
          ) : mediaType === 'video' ? (
            <video
              ref={mediaRef as React.RefObject<HTMLVideoElement>}
              src={mediaUrl}
              controls
              className="max-w-full max-h-full rounded-lg shadow-lg"
              style={{ maxHeight: 'calc(90vh - 180px)' }}
            >
              您的浏览器不支持视频播放
            </video>
          ) : (
            <div className="w-full max-w-2xl">
              <audio
                ref={mediaRef as React.RefObject<HTMLAudioElement>}
                src={mediaUrl}
                controls
                className="w-full"
              >
                您的浏览器不支持音频播放
              </audio>
              <div className="mt-6 text-center">
                <div className="inline-flex items-center justify-center w-32 h-32 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mb-4">
                  <svg
                    className="w-16 h-16 text-white"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                  </svg>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {fileName || '正在播放音频'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 底部提示 */}
        <div className="p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-center">
            <span className="hidden sm:inline">点击背景或按 ESC 键关闭</span>
            <span className="sm:hidden">点击背景或按 ESC 关闭</span>
          </p>
        </div>
      </div>
    </div>
  );
}
