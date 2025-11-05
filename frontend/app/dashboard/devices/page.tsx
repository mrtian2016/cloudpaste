'use client';

/**
 * 设备管理页面
 */
import { useEffect, useState } from 'react';
import { Monitor, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, CardContent, CardHeader } from '@cloudpaste/shared/components';
import { deviceApi, formatDate } from '@cloudpaste/shared/lib';
import type { Device } from '@cloudpaste/shared/types';

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 加载设备列表
  const loadDevices = async () => {
    setIsLoading(true);
    try {
      const data = await deviceApi.getList();
      setDevices(data);
    } catch (error) {
      console.error('加载设备列表失败:', error);
      toast.error('加载失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* 头部 */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          设备管理
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          查看所有同步设备。设备会在登录时自动注册。
        </p>
      </div>

      {/* 工具栏 - 响应式布局 */}
      <div className="mb-4 sm:mb-6 flex justify-end">
        <Button variant="secondary" onClick={loadDevices} className="w-full sm:w-auto">
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* 设备列表 */}
      {isLoading && devices.length === 0 ? (
        <div className="text-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">加载中...</p>
        </div>
      ) : devices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Monitor className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-2">
              暂无设备
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              设备会在登录时自动注册
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {devices.map((device) => (
            <Card key={device.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="p-3 sm:p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-2 sm:p-3 bg-blue-100 dark:bg-blue-900 rounded-lg flex-shrink-0">
                      <Monitor className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white truncate">
                        {device.device_name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {device.device_type || '未知类型'}
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-4">
                <div className="space-y-2 text-xs sm:text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">设备ID:</span>
                    <p className="text-gray-900 dark:text-white font-mono text-xs break-all mt-1">
                      {device.device_id}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">最后同步:</span>
                    <p className="text-gray-900 dark:text-white mt-1">
                      {device.last_sync ? formatDate(device.last_sync) : '从未同步'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">注册时间:</span>
                    <p className="text-gray-900 dark:text-white mt-1">
                      {formatDate(device.created_at)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
