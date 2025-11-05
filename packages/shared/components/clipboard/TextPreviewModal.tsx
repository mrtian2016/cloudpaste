'use client';

/**
 * 文本预览 Modal 组件
 */
import { X, Copy } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Button } from '../ui/Button';
import { toast } from 'sonner';
import { copyToClipboard } from '../../lib/utils';
import { beautifyContent, looksLikeCode } from '../../lib/htmlUtils';

interface TextPreviewModalProps {
  isOpen: boolean;
  content: string;
  onClose: () => void;
}

export function TextPreviewModal({ isOpen, content, onClose }: TextPreviewModalProps) {
  // 美化处理内容（必须在 return null 之前调用，遵循 Hooks 规则）
  const { displayText, isCode } = useMemo(() => beautifyContent(content), [content]);
  const isCodeSnippet = isCode || looksLikeCode(displayText);

  // ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    // 复制纯文本内容（不带 HTML 标签）
    const success = await copyToClipboard(displayText);
    if (success) {
      toast.success('已复制到剪贴板');
    } else {
      toast.error('复制失败');
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
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
          <h3 className="font-medium text-base sm:text-lg text-gray-900 dark:text-white">
            文本预览
          </h3>

          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopy}
              className="p-1.5 sm:p-2"
              title="复制"
            >
              <Copy className="w-4 h-4" />
              <span className="ml-1.5 hidden sm:inline">复制</span>
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="p-1.5 sm:p-2"
              title="关闭"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </div>
        </div>

        {/* 文本内容区域 - 可滚动 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {isCodeSnippet ? (
            <pre className="whitespace-pre-wrap break-words font-mono text-sm sm:text-base text-gray-900 dark:text-gray-100 leading-relaxed bg-gray-50 dark:bg-gray-900 p-4 rounded border border-gray-200 dark:border-gray-700">
              {displayText}
            </pre>
          ) : (
            <div className="whitespace-pre-wrap break-words text-sm sm:text-base text-gray-900 dark:text-gray-100 leading-relaxed">
              {displayText}
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
