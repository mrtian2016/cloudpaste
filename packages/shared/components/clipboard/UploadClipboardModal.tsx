'use client';

/**
 * 上传剪贴板 Modal 组件
 * 支持文字、图片、文件上传
 * 通过 WebSocket 同步到所有设备
 */
import { useState, useRef } from 'react';
import { X, Type, Image as ImageIcon, File as FileIcon, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { fileApi } from '../../lib/api';
import { generateDeviceId, getDeviceName } from '../../lib/utils';
import type { ClipboardSyncData } from '../../types';

interface UploadClipboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  syncClipboard: (data: ClipboardSyncData) => boolean;
  deviceId?: string;  // 可选：如果提供则使用，否则使用默认生成方式
  deviceName?: string;  // 可选：如果提供则使用，否则使用默认生成方式
}

type UploadType = 'text' | 'image' | 'file';

export function UploadClipboardModal({
  isOpen,
  onClose,
  onSuccess,
  syncClipboard,
  deviceId: propDeviceId,
  deviceName: propDeviceName
}: UploadClipboardModalProps) {
  const [uploadType, setUploadType] = useState<UploadType>('text');
  const [textContent, setTextContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    if (isUploading) return;
    setTextContent('');
    setSelectedFile(null);
    setUploadType('text');
    onClose();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (isUploading) return;

    try {
      setIsUploading(true);

      // 优先使用传入的设备信息，否则使用默认生成方式（浏览器端）
      const deviceId = propDeviceId || generateDeviceId();
      const deviceName = propDeviceName || getDeviceName();

      if (uploadType === 'text') {
        // 上传文字：直接通过 WebSocket 同步
        if (!textContent.trim()) {
          toast.error('请输入文字内容');
          return;
        }

        const success = syncClipboard({
          content: textContent,
          content_type: 'text',
          device_id: deviceId,
          device_name: deviceName,
        });

        if (success) {
          toast.success('文字上传成功');
          onSuccess();
          handleClose();
        } else {
          toast.error('WebSocket 未连接，请稍后重试');
        }
      } else {
        // 上传文件或图片：先上传文件，再通过 WebSocket 同步
        if (!selectedFile) {
          toast.error('请选择文件');
          return;
        }

        // 先上传文件到服务器
        const uploadResult = await fileApi.upload(selectedFile, deviceId);

        // 通过 WebSocket 同步剪贴板记录
        const success = syncClipboard({
          content: uploadResult.data.file_url,
          content_type: uploadResult.data.content_type,
          device_id: deviceId,
          device_name: deviceName,
          file_name: uploadResult.data.file_name,
          file_size: uploadResult.data.file_size,
          mime_type: uploadResult.data.mime_type,
        });

        if (success) {
          toast.success(`${uploadType === 'image' ? '图片' : '文件'}上传成功`);
          onSuccess();
          handleClose();
        } else {
          toast.error('WebSocket 未连接，请稍后重试');
        }
      }
    } catch (error: any) {
      console.error('上传失败:', error);
      const message = error.response?.data?.detail || '上传失败，请稍后重试';
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 - 响应式 */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
            上传剪贴板
          </h2>
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50 p-1"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* 内容 - 响应式 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* 类型选择 - 响应式 */}
          <div className="mb-4 sm:mb-6">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">
              选择类型
            </label>
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={() => setUploadType('text')}
                disabled={isUploading}
                className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-3 rounded-lg border-2 transition-all ${
                  uploadType === 'text'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Type className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="font-medium text-xs sm:text-base">文字</span>
              </button>

              <button
                onClick={() => setUploadType('image')}
                disabled={isUploading}
                className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-3 rounded-lg border-2 transition-all ${
                  uploadType === 'image'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="font-medium text-xs sm:text-base">图片</span>
              </button>

              <button
                onClick={() => setUploadType('file')}
                disabled={isUploading}
                className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-3 rounded-lg border-2 transition-all ${
                  uploadType === 'file'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <FileIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="font-medium text-xs sm:text-base">文件</span>
              </button>
            </div>
          </div>

          {/* 内容输入 - 响应式 */}
          <div>
            {uploadType === 'text' ? (
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  文字内容
                </label>
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  disabled={isUploading}
                  placeholder="请输入要保存的文字内容..."
                  className="w-full h-48 sm:h-64 px-3 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <p className="mt-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  {textContent.length} 个字符
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  选择{uploadType === 'image' ? '图片' : '文件'}
                </label>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={uploadType === 'image' ? 'image/*' : '*'}
                  onChange={handleFileSelect}
                  disabled={isUploading}
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 sm:p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all ${
                    isUploading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {selectedFile ? (
                    <div className="space-y-2 sm:space-y-3">
                      {uploadType === 'image' && selectedFile.type.startsWith('image/') ? (
                        <img
                          src={URL.createObjectURL(selectedFile)}
                          alt="预览"
                          className="max-h-48 sm:max-h-64 mx-auto rounded-lg"
                        />
                      ) : (
                        <FileIcon className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-blue-500" />
                      )}
                      <div>
                        <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white break-all px-2">
                          {selectedFile.name}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                          {(selectedFile.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                        }}
                        disabled={isUploading}
                        className="text-xs sm:text-sm"
                      >
                        重新选择
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2 sm:space-y-3">
                      <Upload className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-gray-400" />
                      <div>
                        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                          点击选择{uploadType === 'image' ? '图片' : '文件'}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-500 mt-1">
                          {uploadType === 'image' ? '支持 JPG、PNG、GIF 等格式' : '支持所有文件类型'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 底部按钮 - 响应式 */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 sm:gap-3 p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isUploading}
            className="w-full sm:w-auto"
          >
            取消
          </Button>
          <Button
            onClick={handleUpload}
            disabled={isUploading || (uploadType === 'text' ? !textContent.trim() : !selectedFile)}
            isLoading={isUploading}
            className="w-full sm:w-auto"
          >
            {isUploading ? '上传中...' : '上传'}
          </Button>
        </div>
      </div>
    </div>
  );
}
