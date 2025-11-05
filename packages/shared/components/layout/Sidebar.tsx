'use client';

/**
 * 侧边栏组件
 */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Clipboard,
  Monitor,
  User,
  LogOut,
  Wifi,
  WifiOff,
  X,
  Settings,
  RefreshCw
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store/useAuthStore';
import { Button } from '../ui/Button';
import { toast } from 'sonner';
import { isTauriApp } from '../../lib/apiConfig';

// 导入 Tauri invoke（仅在 Tauri 环境中可用）
let invoke: any = null;
if (isTauriApp()) {
  try {
    invoke = require('@tauri-apps/api/core').invoke;
  } catch (e) {
    console.warn('Tauri API 未加载');
  }
}

interface SidebarProps {
  isConnected?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  onReconnect?: () => void;
}

export function Sidebar({ isConnected = false, isOpen = true, onClose, onReconnect }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();

  // 检测是否在 Tauri 环境中
  const isTauriEnv = isTauriApp();

  const handleLogout = async () => {
    // 清除 Tauri 配置（如果在 Tauri 环境中）
    if (invoke) {
      try {
        console.log('🧹 正在清除 Tauri 配置...');
        await invoke('clear_api_config');
        console.log('✅ Tauri 配置已清除');
      } catch (error) {
        console.error('❌ 清除 Tauri 配置失败:', error);
        // 不阻断登出流程
      }
    }

    // 清除前端状态
    clearAuth();
    toast.success('已退出登录');
    router.push('/login');
  };

  const menuItems = [
    {
      name: '剪贴板历史',
      href: '/dashboard',
      icon: Clipboard,
    },
    {
      name: '设备管理',
      href: '/dashboard/devices',
      icon: Monitor,
    },
    {
      name: '个人信息',
      href: '/dashboard/profile',
      icon: User,
    },
    {
      name: '设置',
      href: '/dashboard/settings',
      icon: Settings,
      tauriOnly: true, // 仅在 Tauri 环境中显示
    },
  ];

  // 根据环境过滤菜单项
  const visibleMenuItems = menuItems.filter(item => {
    // 如果菜单项标记为 tauriOnly，只在 Tauri 环境中显示
    if (item.tauriOnly && !isTauriEnv) {
      return false;
    }
    return true;
  });

  return (
    <>
      {/* 移动端遮罩层 */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* 侧边栏 */}
      <div className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-screen transition-transform duration-300 ease-in-out",
        !isOpen && "-translate-x-full lg:translate-x-0"
      )}>
      {/* Logo 和关闭按钮 */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Clipboard className="w-6 h-6 text-blue-600" />
            CloudPaste
          </h1>
          {/* 移动端关闭按钮 */}
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            onClick={onClose}
            aria-label="关闭菜单"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* 连接状态 */}
      <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4 text-green-500" />
                <span className="text-green-600 dark:text-green-400">已连接</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500 dark:text-gray-400">未连接</span>
              </>
            )}
          </div>
          {onReconnect && (
            <button
              onClick={onReconnect}
              disabled={isConnected}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                isConnected
                  ? "text-gray-400 cursor-not-allowed"
                  : "text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
              )}
              aria-label="重新连接"
              title={isConnected ? "已连接" : "点击重新连接"}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 菜单 */}
      <nav className="flex-1 p-4 space-y-1">
        {visibleMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                // 移动端点击菜单项后关闭侧边栏
                if (window.innerWidth < 1024 && onClose) {
                  onClose();
                }
              }}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                isActive
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* 用户信息和退出 */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="mb-3 px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {user?.username}
          </p>
          {user?.email && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {user.email}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5 mr-3" />
          退出登录
        </Button>
      </div>
      </div>
    </>
  );
}
