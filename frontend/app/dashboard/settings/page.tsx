'use client';

/**
 * 设置页面 - 网页端重定向
 * 设置功能仅在桌面端可用
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function SettingsPage() {
  const router = useRouter();

  useEffect(() => {
    // 显示提示信息
    toast.info('设置功能仅在桌面应用中可用');
    // 重定向到主页
    router.push('/dashboard');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">正在跳转...</p>
      </div>
    </div>
  );
}
