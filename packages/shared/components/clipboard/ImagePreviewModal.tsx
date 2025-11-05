'use client';

/**
 * 图片预览 Modal 组件
 * 支持自动缓存（Tauri 环境）
 */
import { X, Download, ZoomIn, ZoomOut, RotateCw, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { useImageCache } from '../../hooks/useImageCache';

interface ImagePreviewModalProps {
  isOpen: boolean;
  imageUrl: string;
  fileName?: string;
  onClose: () => void;
  onDownload?: (url: string, fileName?: string) => Promise<void>;
}

export function ImagePreviewModal({ isOpen, imageUrl: originalImageUrl, fileName, onClose, onDownload }: ImagePreviewModalProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  // 通过 API 加载图片（支持缓存）
  const { imageUrl, isLoading, error } = useImageCache(isOpen ? originalImageUrl : null);

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

  // 鼠标滚轮缩放
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!isOpen) return;
      
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale((prev) => Math.max(0.5, Math.min(3, prev + delta)));
    };

    if (isOpen) {
      window.addEventListener('wheel', handleWheel, { passive: false });
      return () => window.removeEventListener('wheel', handleWheel);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleDownload = async () => {
    if (onDownload) {
      await onDownload(originalImageUrl, fileName);
    }
  };

  const handleClose = () => {
    setScale(1);
    setRotation(0);
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
      {/* 工具栏 - 响应式 */}
      <div className="absolute top-0 left-0 right-0 p-3 sm:p-4 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent pointer-events-none">
        <div className="text-white max-w-[40%] sm:max-w-none">
          <h3 className="font-medium text-sm sm:text-base truncate">{fileName || '图片预览'}</h3>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 pointer-events-auto">
          {/* 移动端隐藏缩小按钮 */}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
            className="text-white hover:bg-white/20 hidden sm:flex p-1.5 sm:p-2"
            title="缩小"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>

          {/* 移动端隐藏缩放百分比 */}
          <span className="text-white text-xs sm:text-sm min-w-[50px] sm:min-w-[60px] text-center hidden sm:inline">
            {Math.round(scale * 100)}%
          </span>

          {/* 移动端隐藏放大按钮 */}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleZoomIn}
            disabled={scale >= 3}
            className="text-white hover:bg-white/20 hidden sm:flex p-1.5 sm:p-2"
            title="放大"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>

          {/* 移动端隐藏旋转按钮 */}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRotate}
            className="text-white hover:bg-white/20 hidden sm:flex p-1.5 sm:p-2"
            title="旋转"
          >
            <RotateCw className="w-4 h-4" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleDownload}
            className="text-white hover:bg-white/20 p-1.5 sm:p-2"
            title="下载"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleClose}
            className="text-white hover:bg-white/20 p-1.5 sm:p-2"
            title="关闭"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
        </div>
      </div>

      {/* 图片容器 - 响应式内边距 */}
      <div className="flex items-center justify-center w-full h-full p-4 sm:p-20 pointer-events-none">
        {isLoading ? (
          <div className="text-center pointer-events-auto">
            <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 animate-spin mx-auto text-white mb-3 sm:mb-4" />
            <p className="text-white text-sm sm:text-base">加载中...</p>
          </div>
        ) : error || !imageUrl ? (
          <div className="text-center pointer-events-auto px-4">
            <p className="text-white text-base sm:text-lg mb-2">图片加载失败</p>
            <p className="text-white/70 text-xs sm:text-sm break-all">{fileName || '未知文件'}</p>
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={fileName || '预览'}
            className="max-w-full max-h-full object-contain transition-transform duration-200 pointer-events-auto"
            style={{
              transform: `scale(${scale}) rotate(${rotation}deg)`,
            }}
          />
        )}
      </div>

      {/* 底部提示 - 响应式 */}
      <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 text-center bg-gradient-to-t from-black/50 to-transparent pointer-events-none">
        <p className="text-white/70 text-xs sm:text-sm">
          <span className="hidden sm:inline">点击背景或按 ESC 键关闭 • 滚轮缩放</span>
          <span className="sm:hidden">点击背景或按 ESC 关闭</span>
        </p>
      </div>
    </div>
  );
}
