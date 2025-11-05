'use client';

/**
 * 剪贴板文本文件项组件
 * 通过 API 加载文本文件
 */
import { Loader2, File as FileIcon } from 'lucide-react';
import { useTextFileLoader } from '../../hooks/useTextFileLoader';

interface ClipboardTextFileItemProps {
  fileUrl: string;
  fileName?: string;
  fileSize?: number;
  onClick: (content: string) => void;
}

export function ClipboardTextFileItem({
  fileUrl,
  fileName,
  fileSize,
  onClick
}: ClipboardTextFileItemProps) {
  const { textContent, isLoading, error } = useTextFileLoader(fileUrl);

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
        <div className="flex items-center justify-center w-8 h-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-gray-900 dark:text-white font-medium truncate">
            {fileName || '未知文件'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            加载中...
          </p>
        </div>
      </div>
    );
  }

  if (error || !textContent) {
    return (
      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
        <FileIcon className="w-8 h-8 text-blue-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-gray-900 dark:text-white font-medium truncate">
            {fileName || '未知文件'}
          </p>
          <p className="text-sm text-red-500">
            文件加载失败
          </p>
          {fileSize && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {(fileSize / 1024).toFixed(2)} KB
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
      onClick={() => onClick(textContent)}
    >
      <FileIcon className="w-8 h-8 text-blue-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-gray-900 dark:text-white font-medium truncate">
          {fileName || '未知文件'}
        </p>
        {fileSize && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {(fileSize / 1024).toFixed(2)} KB
          </p>
        )}
        <p className="text-sm text-blue-500 dark:text-blue-400 mt-1">
          点击预览文件内容
        </p>
      </div>
    </div>
  );
}
