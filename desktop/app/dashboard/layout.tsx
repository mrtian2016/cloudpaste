'use client';

/**
 * Dashboard 布局
 */
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Sidebar } from '@cloudpaste/shared/components/layout/Sidebar';
import { useAuthStore } from '@cloudpaste/shared/store/useAuthStore';
import { useClipboardStore } from '@cloudpaste/shared/store/useClipboardStore';
import { useSettingsStore } from '@cloudpaste/shared/store/useSettingsStore';
import { useWebSocket } from '@cloudpaste/shared/hooks/useWebSocket';
import { WebSocketProvider } from '@cloudpaste/shared/contexts/WebSocketContext';
import { toast } from 'sonner';
import type { ClipboardItem } from '@cloudpaste/shared/types';
import { useClipboard } from '../../lib/hooks/useClipboard';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasHydrated = useAuthStore((state) => state._hasHydrated);
  const { addItem, moveItemToTop } = useClipboardStore();
  const { uploadSettings } = useSettingsStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // WebSocket 连接（需要先创建，因为 useClipboard 需要 syncClipboard）
  const {
    isConnected,
    onlineDevices,
    reconnect,
    syncClipboard,
    getOnlineDevices,
    showDisconnectAlert,
    dismissDisconnectAlert,
  } = useWebSocket({
    autoConnect: isAuthenticated,
    onConnected: (data) => {
      console.log('WebSocket 已连接:', data);
      toast.success('实时同步已启动');
    },
    onDisconnected: () => {
      console.log('WebSocket 已断开');
    },
    onMessage: (message) => {
      // 处理同步确认消息（发送者自己收到）
      if (message.type === 'sync_confirmed' && message.data.clipboard_data) {
        const data = message.data.clipboard_data;
        if (data.clipboard_id) {
          const newItem: ClipboardItem = {
            id: data.clipboard_id,
            content: data.content,
            content_type: data.content_type,
            device_id: data.device_id,
            device_name: data.device_name,
            favorite: false,
            tags: undefined,
            file_name: data.file_name,
            file_size: data.file_size,
            mime_type: data.mime_type,
            updated_at: new Date().toISOString(),
            synced: true,
          };

          addItem(newItem);
          console.log('已添加到本地列表（发送者）:', newItem);
        }
      }
    },
    onClipboardSync: async (data) => {
      console.log('收到剪贴板同步:', data);

      // 如果有 clipboard_id，说明已保存到数据库，添加到列表
      if (data.clipboard_id) {
        const newItem: ClipboardItem = {
          id: data.clipboard_id,
          content: data.content,
          content_type: data.content_type,
          device_id: data.device_id,
          device_name: data.device_name,
          favorite: false,
          tags: undefined,
          file_name: data.file_name,
          file_size: data.file_size,
          mime_type: data.mime_type,
          updated_at: new Date().toISOString(),
          synced: true,
        };

        addItem(newItem);

        // 根据设置决定是否将同步的内容写入本地剪贴板
        console.log('自动复制设置:', uploadSettings.autoCopyToClipboard);
        if (uploadSettings.autoCopyToClipboard) {
          try {
            await writeToClipboard(
              data.content,
              data.content_type,
              {
                fileName: data.file_name,
                mimeType: data.mime_type,
              }
            );

            if (data.content_type === 'text') {
              toast.success('收到新的剪贴板内容，已自动复制');
            } else if (data.content_type === 'image') {
              toast.success('收到图片，已自动复制到剪贴板');
            } else if (data.content_type === 'file') {
              toast.success(`收到文件 ${data.file_name}，已自动复制`);
            }
          } catch (error) {
            console.error('写入剪贴板失败:', error);
            toast.success('收到新的剪贴板内容');
          }
        } else {
          // 未启用自动复制，仅显示通知
          if (data.content_type === 'text') {
            toast.success('收到新的剪贴板内容');
          } else if (data.content_type === 'image') {
            toast.success('收到图片');
          } else if (data.content_type === 'file') {
            toast.success(`收到文件 ${data.file_name}`);
          }
        }
      } else {
        toast.info('收到剪贴板同步');
      }
    },
    onTimestampUpdated: (data) => {
      console.log('收到时间戳更新:', data);

      // 将项移到列表顶部
      if (data.clipboard_item?.clipboard_id) {
        const item = data.clipboard_item;
        moveItemToTop(item.clipboard_id, {
          updated_at: item.updated_at,
        });
        toast.info('剪贴板项已更新');
      }
    },
    onError: (error) => {
      console.error('WebSocket 错误:', error);
    },
  });

  // 启动剪贴板监听（在 WebSocket 创建后，因为需要 syncClipboard）
  const clipboardOptions = useMemo(() => ({
    autoUpload: true,
    showNotification: true,
    syncClipboard,
  }), [syncClipboard]);
  
  const { writeToClipboard } = useClipboard(clipboardOptions);

  // 检查认证状态（等待 hydration 完成）
  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      router.push('/login');
    }
  }, [hasHydrated, isAuthenticated, router]);

  // 等待 hydration 完成
  if (!hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4 animate-pulse">
            <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-gray-600 dark:text-gray-400">加载中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <WebSocketProvider value={{ isConnected, reconnect, syncClipboard, getOnlineDevices, writeToClipboard }}>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <Sidebar
          isConnected={isConnected}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onReconnect={reconnect}
        />

        <main className="flex-1 overflow-auto flex flex-col">
          {/* 断线警告横幅 */}
          {showDisconnectAlert && (
            <div className="sticky top-0 z-50 bg-red-600 text-white px-4 py-3 shadow-lg">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <div className="flex-1">
                    <p className="font-semibold">剪贴板同步已断开</p>
                    <p className="text-sm text-red-100">正在尝试重新连接服务器，请检查网络连接...</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={reconnect}
                    className="px-3 py-1.5 bg-white text-red-600 rounded-md hover:bg-red-50 transition-colors font-medium text-sm whitespace-nowrap"
                  >
                    立即重连
                  </button>
                  <button
                    onClick={dismissDisconnectAlert}
                    className="p-1.5 hover:bg-red-700 rounded-md transition-colors"
                    aria-label="关闭提醒"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 移动端顶部栏（汉堡菜单） */}
          <div className="lg:hidden sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="打开菜单"
              >
                <Menu className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              </button>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                CloudPaste
              </h2>
            </div>
          </div>

          {/* 主内容区 */}
          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </WebSocketProvider>
  );
}
