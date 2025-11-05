'use client';

import { useState, useEffect } from 'react';
import { useSettingsStore } from '@cloudpaste/shared/store';
import { authApi } from '@cloudpaste/shared/lib/api';
import { toast } from 'sonner';
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';
import { RotateCcw, RefreshCw, Download } from 'lucide-react';
import { updateManager, UpdateManager, UpdateProgress } from '@/lib/updateManager';
import { getVersion } from '@tauri-apps/api/app';

export default function SettingsPage() {
  const { uploadSettings, updateUploadSettings, resetToDefaults } = useSettingsStore();

  const [localSettings, setLocalSettings] = useState(uploadSettings);
  const [newExtension, setNewExtension] = useState('');
  const [newPattern, setNewPattern] = useState('');
  const [autoStart, setAutoStart] = useState(false);
  const [autoStartLoading, setAutoStartLoading] = useState(true);

  // 更新相关状态
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<UpdateProgress>({
    show: false,
    downloaded: 0,
    total: 0,
    status: ""
  });
  const [updateAvailable, setUpdateAvailable] = useState<any>(null);

  // 同步 store 中的设置到本地状态
  useEffect(() => {
    setLocalSettings(uploadSettings);
  }, [uploadSettings]);

  // 从后端加载用户设置
  useEffect(() => {
    const loadUserSettings = async () => {
      try {
        const settings = await authApi.getUserSettings();
        // 更新本地设置
        updateUploadSettings({ maxHistoryItems: settings.max_history_items });
      } catch (error) {
        console.error('加载用户设置失败:', error);
      }
    };
    loadUserSettings();
  }, [updateUploadSettings]);

  // 检查自动启动状态
  useEffect(() => {
    const checkAutoStart = async () => {
      try {
        const enabled = await isEnabled();
        setAutoStart(enabled);
      } catch (error) {
        console.error('检查自动启动状态失败:', error);
      } finally {
        setAutoStartLoading(false);
      }
    };
    checkAutoStart();
  }, []);

  // 订阅更新进度
  useEffect(() => {
    const unsubscribe = updateManager.subscribe((progress) => {
      setUpdateProgress(progress);
    });
    return unsubscribe;
  }, []);

  // 获取当前版本号
  useEffect(() => {
    const loadVersion = async () => {
      try {
        const version = await getVersion();
        setCurrentVersion(version);
      } catch (error) {
        console.error('获取版本号失败:', error);
      }
    };
    loadVersion();
  }, []);

  const handleReset = () => {
    resetToDefaults();
    setLocalSettings(useSettingsStore.getState().uploadSettings);
    toast.success('已重置为默认设置');
  };

  const handleAutoStartToggle = async (checked: boolean) => {
    try {
      if (checked) {
        await enable();
        setAutoStart(true);
        toast.success('已启用开机自动启动');
      } else {
        await disable();
        setAutoStart(false);
        toast.success('已禁用开机自动启动');
      }
    } catch (error) {
      console.error('切换自动启动失败:', error);
      toast.error('设置失败，请重试');
    }
  };

  const addExtension = () => {
    if (!newExtension.trim()) return;
    const ext = newExtension.trim().toLowerCase().replace(/^\./, '');
    if (!localSettings.allowedExtensions.includes(ext)) {
      const newExtensions = [...localSettings.allowedExtensions, ext];
      setLocalSettings({ ...localSettings, allowedExtensions: newExtensions });
      updateUploadSettings({ allowedExtensions: newExtensions });
      setNewExtension('');
      toast.success(`已添加扩展名: .${ext}`);
    } else {
      toast.error('该扩展名已存在');
    }
  };

  const removeExtension = (ext: string) => {
    const newExtensions = localSettings.allowedExtensions.filter((e) => e !== ext);
    setLocalSettings({ ...localSettings, allowedExtensions: newExtensions });
    updateUploadSettings({ allowedExtensions: newExtensions });
    toast.success(`已移除扩展名: .${ext}`);
  };

  const addPattern = () => {
    if (!newPattern.trim()) return;
    try {
      new RegExp(newPattern); // 验证正则表达式
      if (!localSettings.fileNameFilterPatterns.includes(newPattern)) {
        const newPatterns = [...localSettings.fileNameFilterPatterns, newPattern];
        setLocalSettings({ ...localSettings, fileNameFilterPatterns: newPatterns });
        updateUploadSettings({ fileNameFilterPatterns: newPatterns });
        setNewPattern('');
        toast.success('已添加过滤规则');
      } else {
        toast.error('该规则已存在');
      }
    } catch (error) {
      toast.error('无效的正则表达式');
    }
  };

  const removePattern = (pattern: string) => {
    const newPatterns = localSettings.fileNameFilterPatterns.filter((p) => p !== pattern);
    setLocalSettings({ ...localSettings, fileNameFilterPatterns: newPatterns });
    updateUploadSettings({ fileNameFilterPatterns: newPatterns });
    toast.success('已移除过滤规则');
  };

  // 检查更新
  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    try {
      const update = await updateManager.checkForUpdates();
      if (update?.available) {
        setUpdateAvailable(update);
        toast.success(`发现新版本 ${update.version}`, {
          description: '点击"立即更新"按钮开始下载',
          duration: 5000,
        });
      } else {
        toast.success('当前已是最新版本');
      }
    } catch (error) {
      console.error('检查更新失败:', error);
      toast.error('检查更新失败，请稍后重试');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  // 下载并安装更新
  const handleDownloadUpdate = async () => {
    if (!updateAvailable) return;

    try {
      await updateManager.downloadAndInstall(updateAvailable);
      toast.success('更新已下载完成', {
        description: '点击"重启应用"按钮完成更新',
        duration: 5000,
      });
    } catch (error) {
      console.error('下载更新失败:', error);
      toast.error('下载更新失败，请稍后重试');
    }
  };

  // 重启应用
  const handleRestartApp = async () => {
    try {
      await updateManager.restartApp();
    } catch (error) {
      console.error('重启应用失败:', error);
      toast.error('重启应用失败');
    }
  };

  return (
    <div className="p-3 sm:p-4 max-w-6xl mx-auto">
      {/* 头部 */}
      <div className="mb-3 sm:mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-1">
          应用设置
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
          配置文件上传规则和限制
        </p>
      </div>

      {/* 第一行：基础设置（响应式网格布局） */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 mb-3 sm:mb-4">
        {/* 自动上传开关 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">自动上传</h2>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                自动上传剪贴板内容
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.autoUpload}
                onChange={(e) => {
                  const newValue = e.target.checked;
                  setLocalSettings({ ...localSettings, autoUpload: newValue });
                  updateUploadSettings({ autoUpload: newValue });
                  toast.success(newValue ? '已启用自动上传' : '已禁用自动上传');
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* 自动复制到剪贴板开关 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">自动复制</h2>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                同步时自动写入剪贴板
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.autoCopyToClipboard}
                onChange={(e) => {
                  const newValue = e.target.checked;
                  setLocalSettings({ ...localSettings, autoCopyToClipboard: newValue });
                  // 立即保存到 store
                  updateUploadSettings({ autoCopyToClipboard: newValue });
                  toast.success(newValue ? '已启用自动复制到剪贴板' : '已禁用自动复制到剪贴板');
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* 开机自动启动 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">开机自动启动</h2>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                系统启动时自动运行
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoStart}
                onChange={(e) => handleAutoStartToggle(e.target.checked)}
                disabled={autoStartLoading}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
            </label>
          </div>
        </div>

        {/* 文件大小限制 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">文件大小限制</h2>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                {localSettings.enableSizeLimit ? `最大 ${localSettings.maxFileSizeMB} MB` : '未启用'}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.enableSizeLimit}
                onChange={(e) => {
                  const newValue = e.target.checked;
                  setLocalSettings({ ...localSettings, enableSizeLimit: newValue });
                  updateUploadSettings({ enableSizeLimit: newValue });
                  toast.success(newValue ? '已启用文件大小限制' : '已禁用文件大小限制');
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {localSettings.enableSizeLimit && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="1000"
                value={localSettings.maxFileSizeMB}
                onChange={(e) => {
                  const newValue = parseInt(e.target.value) || 50;
                  setLocalSettings({ ...localSettings, maxFileSizeMB: newValue });
                  updateUploadSettings({ maxFileSizeMB: newValue });
                }}
                onBlur={() => toast.success('文件大小限制已更新')}
                className="w-20 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">MB</span>
            </div>
          )}
        </div>

        {/* 历史数据保留条数 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
          <div className="mb-2">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">历史数据保留</h2>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
              最大 <span className="font-medium text-blue-600 dark:text-blue-400">{localSettings.maxHistoryItems}</span> 条
            </p>
          </div>
          <input
            type="number"
            min="100"
            max="10000"
            step="100"
            value={localSettings.maxHistoryItems}
            onChange={(e) => {
              const newValue = parseInt(e.target.value) || 1000;
              setLocalSettings({ ...localSettings, maxHistoryItems: newValue });
              updateUploadSettings({ maxHistoryItems: newValue });
            }}
            onBlur={async () => {
              try {
                // 同步到后端
                await authApi.updateUserSettings({
                  max_history_items: localSettings.maxHistoryItems
                });
                toast.success('历史数据保留条数已更新');
              } catch (error) {
                console.error('更新用户设置失败:', error);
                toast.error('更新失败，请重试');
              }
            }}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        {/* 应用更新 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
          <div className="mb-2">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">应用更新</h2>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
              {currentVersion && (
                <>
                  v{currentVersion}
                  {updateAvailable && (
                    <> → <span className="font-medium text-blue-600 dark:text-blue-400">v{updateAvailable.version}</span></>
                  )}
                </>
              )}
            </p>
          </div>

          {/* 更新进度 */}
          {updateProgress.show ? (
            <div className="space-y-2">
              <div className="text-xs text-gray-700 dark:text-gray-300">
                {updateProgress.status === 'downloading' && '下载中...'}
                {updateProgress.status === 'installing' && '安装中...'}
                {updateProgress.status === 'done' && '已完成'}
              </div>

              {/* 进度条 */}
              {updateProgress.status === 'downloading' && updateProgress.total > 0 && (
                <>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full transition-all duration-300 ease-out"
                      style={{
                        width: `${UpdateManager.calculateProgress(updateProgress.downloaded, updateProgress.total)}%`
                      }}
                    />
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 text-right">
                    {UpdateManager.calculateProgress(updateProgress.downloaded, updateProgress.total)}%
                  </div>
                </>
              )}

              {/* 重启按钮 */}
              {updateProgress.status === 'done' && (
                <button
                  onClick={handleRestartApp}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  重启
                </button>
              )}
            </div>
          ) : (
            /* 检查更新/立即更新按钮 */
            !updateAvailable ? (
              <button
                onClick={handleCheckUpdate}
                disabled={isCheckingUpdate}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                {isCheckingUpdate ? '检查中' : '检查更新'}
              </button>
            ) : (
              <button
                onClick={handleDownloadUpdate}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                立即更新
              </button>
            )
          )}
        </div>
      </div>

      <div className="space-y-3 sm:space-y-4">

        {/* 文件类型过滤 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">文件类型过滤</h2>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                只允许特定类型的文件上传
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.enableFileTypeFilter}
                onChange={(e) => {
                  const newValue = e.target.checked;
                  setLocalSettings({ ...localSettings, enableFileTypeFilter: newValue });
                  updateUploadSettings({ enableFileTypeFilter: newValue });
                  toast.success(newValue ? '已启用文件类型过滤' : '已禁用文件类型过滤');
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {localSettings.enableFileTypeFilter && (
            <div className="mt-2 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newExtension}
                  onChange={(e) => setNewExtension(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addExtension()}
                  placeholder="输入扩展名 (如: pdf)"
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
                <button
                  onClick={addExtension}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors whitespace-nowrap"
                >
                  添加
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                {localSettings.allowedExtensions.map((ext) => (
                  <span
                    key={ext}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs"
                  >
                    .{ext}
                    <button
                      onClick={() => removeExtension(ext)}
                      className="ml-0.5 text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100 text-sm"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                共 {localSettings.allowedExtensions.length} 种文件类型
              </p>
            </div>
          )}
        </div>

        {/* 文件名过滤规则 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">文件名过滤规则</h2>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                使用正则表达式排除特定文件
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.enableFileNameFilter}
                onChange={(e) => {
                  const newValue = e.target.checked;
                  setLocalSettings({ ...localSettings, enableFileNameFilter: newValue });
                  updateUploadSettings({ enableFileNameFilter: newValue });
                  toast.success(newValue ? '已启用文件名过滤' : '已禁用文件名过滤');
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {localSettings.enableFileNameFilter && (
            <div className="mt-2 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPattern}
                  onChange={(e) => setNewPattern(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addPattern()}
                  placeholder="正则表达式 (如: .*\.tmp$)"
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 font-mono"
                />
                <button
                  onClick={addPattern}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors whitespace-nowrap"
                >
                  添加
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                {localSettings.fileNameFilterPatterns.map((pattern, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded-full text-xs font-mono"
                  >
                    {pattern}
                    <button
                      onClick={() => removePattern(pattern)}
                      className="ml-0.5 text-orange-600 dark:text-orange-300 hover:text-orange-800 dark:hover:text-orange-100 text-sm"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                共 {localSettings.fileNameFilterPatterns.length} 条过滤规则
              </p>
            </div>
          )}
        </div>

      </div>

      {/* 操作按钮 - 固定在底部 */}
      <div className="sticky bottom-0 mt-6 pt-4 pb-2 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent dark:from-gray-900 dark:via-gray-900 dark:to-transparent flex justify-center">
        <button
          onClick={handleReset}
          className="group inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-orange-700 dark:text-orange-300 bg-white dark:bg-gray-800 border-2 border-orange-200 dark:border-orange-800 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:border-orange-300 dark:hover:border-orange-700 transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <RotateCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
          <span>重置为默认设置</span>
        </button>
      </div>
    </div>
  );
}
