'use client';

/**
 * 剪贴板历史列表页面
 */
import { useEffect, useState } from 'react';
import {
  Search,
  Star,
  Copy,
  Trash2,
  Filter,
  RefreshCw,
  Download,
  Image as ImageIcon,
  File as FileIcon,
  Check,
  Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { ask } from '@tauri-apps/plugin-dialog';
import { Button } from '@cloudpaste/shared/components/ui/Button';
import { Input } from '@cloudpaste/shared/components/ui/Input';
import { Card, CardContent } from '@cloudpaste/shared/components/ui/Card';
import { UploadClipboardModal } from '@cloudpaste/shared/components/clipboard/UploadClipboardModal';
import { ImagePreviewModal } from '@cloudpaste/shared/components/clipboard/ImagePreviewModal';
import { TextPreviewModal } from '@cloudpaste/shared/components/clipboard/TextPreviewModal';
import { MediaPreviewModal } from '@/components/MediaPreviewModal';
import { ClipboardImageItem } from '@cloudpaste/shared/components/clipboard/ClipboardImageItem';
import { ClipboardTextFileItem } from '@cloudpaste/shared/components/clipboard/ClipboardTextFileItem';
import { ClipboardMediaFileItem } from '@cloudpaste/shared/components/clipboard/ClipboardMediaFileItem';
import { clipboardApi } from '@cloudpaste/shared/lib/api';
import { useClipboardStore } from '@cloudpaste/shared/store/useClipboardStore';
import { useWebSocketContext } from '@cloudpaste/shared/contexts/WebSocketContext';
import { formatDate, copyToClipboard, truncateText, isPreviewableTextFile, isPreviewableMediaFile, getMediaType } from '@cloudpaste/shared/lib/utils';
import { beautifyContent, looksLikeCode } from '@cloudpaste/shared/lib/htmlUtils';
import { downloadFileNative } from '@/lib/tauriFileUtils';
import { getApiBaseUrl } from '@cloudpaste/shared/lib/apiConfig';
import { getDeviceId, getDeviceName } from '@/lib/device';
import type { ClipboardItem } from '@cloudpaste/shared/types';

export default function DashboardPage() {
  const {
    items,
    total,
    currentPage,
    pageSize,
    filter,
    selectedIds,
    setItems,
    addItem,
    updateItem,
    removeItem,
    removeItems,
    setFilter,
    setPage,
    toggleSelection,
    selectAll,
    clearSelection,
  } = useClipboardStore();

  const { syncClipboard, writeToClipboard } = useWebSocketContext();

  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFavoriteOnly, setShowFavoriteOnly] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; name?: string } | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewMedia, setPreviewMedia] = useState<{ fileUrl: string; type: 'audio' | 'video'; name?: string } | null>(null);
  const [deviceId, setDeviceId] = useState<string>('');
  const [deviceName, setDeviceName] = useState<string>('');

  // 构建文件完整 URL（使用登录时保存的 API 地址）
  const buildFileUrl = (fileIdOrUrl: string): string => {
    const apiBaseUrl = getApiBaseUrl();

    // 如果已经是完整 URL（包含协议），直接返回
    if (fileIdOrUrl.startsWith('http://') || fileIdOrUrl.startsWith('https://')) {
      return fileIdOrUrl;
    }

    // 如果是相对路径（以 /api/ 开头），拼接 base URL
    if (fileIdOrUrl.startsWith('/api/')) {
      return `${apiBaseUrl}${fileIdOrUrl}`;
    }

    // 否则是文件 ID，拼接完整路径
    return `${apiBaseUrl}/api/v1/files/download/${fileIdOrUrl}`;
  };

  // 加载剪贴板列表
  const loadClipboard = async () => {
    setIsLoading(true);
    try {
      const response = await clipboardApi.getList(filter);
      setItems(response.items, response.total);
    } catch (error: any) {
      console.error('加载剪贴板列表失败:', error);
      toast.error('加载失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 初始化设备信息
  useEffect(() => {
    const initDeviceInfo = async () => {
      const id = await getDeviceId();
      const name = await getDeviceName();
      setDeviceId(id);
      setDeviceName(name);
      console.log('设备信息已加载:', { id, name });
    };
    initDeviceInfo();
  }, []);

  // 初始加载
  useEffect(() => {
    loadClipboard();
  }, [filter]);
  // 搜索
  const handleSearch = () => {
    setFilter({ search: searchQuery, page: 1 });
  };

  // 切换收藏筛选
  const handleToggleFavorite = () => {
    const newValue = !showFavoriteOnly;
    setShowFavoriteOnly(newValue);
    setFilter({ favorite: newValue || undefined, page: 1 });
  };

  // 复制到剪贴板
  const handleCopy = async (item: ClipboardItem) => {
    try {
      // 使用 writeToClipboard 避免触发剪贴板监听事件
      if (writeToClipboard) {
        // 对于文本类型，先提取纯文本（去除 HTML 标签）
        let contentToCopy = item.content;
        if (item.content_type === 'text') {
          const { displayText } = beautifyContent(item.content);
          contentToCopy = displayText;
        }
        
        await writeToClipboard(
          contentToCopy,
          item.content_type,
          {
            fileName: item.file_name,
            mimeType: item.mime_type,
          }
        );
        
        if (item.content_type === 'text') {
          toast.success('文本已复制到剪贴板');
        } else if (item.content_type === 'image') {
          toast.success('图片已复制到剪贴板');
        } else if (item.content_type === 'file') {
          toast.success(`文件 ${item.file_name} 已复制到剪贴板`);
        } else {
          toast.success('已复制到剪贴板');
        }
      } else {
        // 降级方案：仅支持文本
        const success = await copyToClipboard(item.content);
        if (success) {
          toast.success('已复制到剪贴板');
        } else {
          toast.error('复制失败');
        }
      }
    } catch (error) {
      console.error('复制失败:', error);
      toast.error('复制失败');
    }
  };

  // 切换收藏
  const handleToggleFavoriteItem = async (item: ClipboardItem) => {
    try {
      await clipboardApi.update(item.id, { favorite: !item.favorite });
      updateItem(item.id, { favorite: !item.favorite });
      toast.success(item.favorite ? '已取消收藏' : '已收藏');
    } catch (error) {
      toast.error('操作失败');
    }
  };

  // 删除单个项
  const handleDelete = async (id: number) => {
    const confirmed = await ask('确定要删除这条记录吗？', {
      title: '确认删除',
      kind: 'warning',
      okLabel: '删除',
      cancelLabel: '取消'
    });

    if (!confirmed) return;

    try {
      await clipboardApi.delete(id);
      removeItem(id);
      toast.success('删除成功');
    } catch (error) {
      toast.error('删除失败');
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) {
      toast.warning('请先选择要删除的项');
      return;
    }

    const confirmed = await ask(`确定要删除选中的 ${selectedIds.length} 条记录吗？`, {
      title: '确认批量删除',
      kind: 'warning',
      okLabel: '删除',
      cancelLabel: '取消'
    });

    if (!confirmed) return;

    try {
      await clipboardApi.batchDelete(selectedIds);
      removeItems(selectedIds);
      clearSelection();
      toast.success('批量删除成功');
    } catch (error) {
      toast.error('批量删除失败');
    }
  };

  // 下载文件
  const handleDownload = async (url: string, fileName?: string) => {
    try {
      await downloadFileNative(url, fileName);
      toast.success('文件保存成功');
    } catch (error) {
      console.error('下载失败:', error);
      toast.error('文件保存失败');
    }
  };


  // 分页
  const totalPages = Math.ceil(total / pageSize);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setPage(currentPage + 1);
    }
  };

  // 渲染内容图标
  const renderContentIcon = (item: ClipboardItem) => {
    if (item.content_type === 'image') {
      return <ImageIcon className="w-5 h-5 text-purple-500" />;
    } else if (item.content_type === 'file') {
      return <FileIcon className="w-5 h-5 text-blue-500" />;
    }
    return null;
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* 头部 */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          剪贴板历史
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          共 {total} 条记录
        </p>
      </div>

      {/* 工具栏 */}
      <div className="mb-4 sm:mb-6 space-y-3">
        {/* 搜索栏 - 响应式宽度 */}
        <div className="flex gap-2 w-full">
          <Input
            placeholder="搜索剪贴板内容..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="h-9 flex-1"
          />
          <Button onClick={handleSearch} size="sm" className="shrink-0">
            <Search className="w-4 h-4 sm:mr-1.5" />
            <span className="hidden sm:inline">搜索</span>
          </Button>
        </div>

        {/* 操作按钮 - 响应式布局 */}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsUploadModalOpen(true)}
            className="whitespace-nowrap"
          >
            <Plus className="w-4 h-4 sm:mr-1.5" />
            <span className="hidden sm:inline">上传</span>
          </Button>

          <Button
            size="sm"
            variant={showFavoriteOnly ? 'primary' : 'secondary'}
            onClick={handleToggleFavorite}
            className="whitespace-nowrap"
          >
            <Star className="w-4 h-4 sm:mr-1.5" />
            <span className="hidden sm:inline">{showFavoriteOnly ? '显示全部' : '仅收藏'}</span>
            <span className="sm:hidden">{showFavoriteOnly ? '全部' : '收藏'}</span>
          </Button>

          <Button size="sm" variant="secondary" onClick={loadClipboard} className="whitespace-nowrap">
            <RefreshCw className={`w-4 h-4 sm:mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">刷新</span>
          </Button>

          {selectedIds.length > 0 && (
            <Button size="sm" variant="danger" onClick={handleBatchDelete} className="whitespace-nowrap">
              <Trash2 className="w-4 h-4 sm:mr-1.5" />
              <span className="hidden sm:inline">删除选中 ({selectedIds.length})</span>
              <span className="sm:hidden">删除 ({selectedIds.length})</span>
            </Button>
          )}
        </div>
      </div>

      {/* 列表 */}
      {isLoading && items.length === 0 ? (
        <div className="text-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">加载中...</p>
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">暂无剪贴板记录</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start gap-2 sm:gap-4">
                  {/* 选择框 */}
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={() => toggleSelection(item.id)}
                    className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 flex-shrink-0"
                  />

                  {/* 内容 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {renderContentIcon(item)}
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {item.device_name || item.device_id}
                      </span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(item.updated_at)}
                      </span>
                      {item.favorite && (
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      )}
                    </div>

                    {item.content_type === 'image' ? (
                      <ClipboardImageItem
                        fileUrl={buildFileUrl(item.content)}
                        fileName={item.file_name}
                        onClick={() => setPreviewImage({ url: buildFileUrl(item.content), name: item.file_name })}
                      />
                    ) : item.content_type === 'file' ? (
                      isPreviewableTextFile(item.file_name, item.mime_type) ? (
                        <ClipboardTextFileItem
                          fileUrl={buildFileUrl(item.content)}
                          fileName={item.file_name}
                          fileSize={item.file_size}
                          onClick={(content) => setPreviewText(content)}
                        />
                      ) : isPreviewableMediaFile(item.file_name, item.mime_type) ? (
                        <ClipboardMediaFileItem
                          fileName={item.file_name}
                          fileSize={item.file_size}
                          mediaType={getMediaType(item.file_name, item.mime_type)!}
                          onClick={() => setPreviewMedia({
                            fileUrl: buildFileUrl(item.content),
                            type: getMediaType(item.file_name, item.mime_type)!,
                            name: item.file_name
                          })}
                        />
                      ) : (
                        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                          <FileIcon className="w-8 h-8 text-blue-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-900 dark:text-white font-medium truncate">
                              {item.file_name || '未知文件'}
                            </p>
                            {item.file_size && (
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {(item.file_size / 1024).toFixed(2)} KB
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    ) : (
                      (() => {
                        // 美化处理内容（智能处理 HTML 和 IDE 复制的代码）
                        const { displayText, isCode } = beautifyContent(item.content);
                        const isCodeSnippet = isCode || looksLikeCode(displayText);
                        
                        return (
                          <div
                            className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 p-2 rounded transition-colors overflow-hidden"
                            onClick={() => setPreviewText(item.content)}
                          >
                            <p className={`whitespace-pre-wrap break-words ${
                              isCodeSnippet
                                ? 'font-mono text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-2 rounded'
                                : 'text-gray-900 dark:text-white'
                            }`}>{truncateText(displayText, 200)}</p>
                            {displayText.length > 200 && (
                              <p className="text-sm text-blue-500 dark:text-blue-400 mt-1">
                                点击查看完整内容
                              </p>
                            )}
                          </div>
                        );
                      })()
                    )}

                    {item.tags && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.tags.split(',').map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded"
                          >
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 操作按钮 - 响应式布局 */}
                  <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopy(item)}
                      title="复制"
                      className="p-1.5 sm:p-2"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleFavoriteItem(item)}
                      title={item.favorite ? '取消收藏' : '收藏'}
                      className="p-1.5 sm:p-2"
                    >
                      <Star
                        className={`w-4 h-4 ${
                          item.favorite ? 'fill-yellow-500 text-yellow-500' : ''
                        }`}
                      />
                    </Button>

                    {item.content_type !== 'text' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            await downloadFileNative(buildFileUrl(item.content), item.file_name);
                            toast.success('文件保存成功');
                          } catch (error) {
                            toast.error('文件保存失败');
                          }
                        }}
                        title="下载"
                        className="p-1.5 sm:p-2 hidden sm:flex"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(item.id)}
                      title="删除"
                      className="text-red-600 hover:text-red-700 p-1.5 sm:p-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 分页 - 响应式布局 */}
      {totalPages > 1 && (
        <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            第 {currentPage} / {totalPages} 页
          </p>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="secondary"
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              size="sm"
              className="flex-1 sm:flex-none"
            >
              上一页
            </Button>
            <Button
              variant="secondary"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              size="sm"
              className="flex-1 sm:flex-none"
            >
              下一页
            </Button>
          </div>
        </div>
      )}

      {/* 上传 Modal */}
      <UploadClipboardModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={() => {
          // WebSocket 会自动同步到所有设备（包括当前设备）
          setIsUploadModalOpen(false);
        }}
        syncClipboard={syncClipboard}
        deviceId={deviceId}
        deviceName={deviceName}
      />

      {/* 图片预览 Modal */}
      <ImagePreviewModal
        isOpen={!!previewImage}
        imageUrl={previewImage?.url || ''}
        fileName={previewImage?.name}
        onClose={() => setPreviewImage(null)}
        onDownload={handleDownload}
      />

      {/* 文本预览 Modal */}
      <TextPreviewModal
        isOpen={!!previewText}
        content={previewText || ''}
        onClose={() => setPreviewText(null)}
      />

      {/* 媒体预览 Modal */}
      <MediaPreviewModal
        isOpen={!!previewMedia}
        fileUrl={previewMedia?.fileUrl || ''}
        mediaType={previewMedia?.type || 'video'}
        fileName={previewMedia?.name}
        onClose={() => setPreviewMedia(null)}
        onDownload={handleDownload}
      />
    </div>
  );
}
