'use client';

/**
 * 首页 - 根据认证状态重定向
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@cloudpaste/shared/store/useAuthStore';
import { Clipboard } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasHydrated = useAuthStore((state) => state._hasHydrated);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // 等待 hydration 完成
    if (hasHydrated) {
      setIsReady(true);
    }
  }, [hasHydrated]);

  useEffect(() => {
    // 只在 hydration 完成后才进行重定向
    if (isReady) {
      if (isAuthenticated) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    }
  }, [isReady, isAuthenticated, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4 animate-pulse">
          <Clipboard className="w-8 h-8 text-white" />
        </div>
        <p className="text-gray-600 dark:text-gray-400">加载中...</p>
      </div>
    </div>
  );
}
