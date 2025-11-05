/**
 * Tauri 配置同步 Hook
 * 自动同步前端配置到 Rust 后端，用于剪贴板同步
 */
import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAuthStore } from '@cloudpaste/shared/store/useAuthStore';
import { getApiBaseUrl } from '@cloudpaste/shared/lib/apiConfig';

export function useTauriConfig() {
  const { token, isAuthenticated } = useAuthStore();

  useEffect(() => {
    const syncConfig = async () => {
      if (isAuthenticated && token) {
        try {
          const apiUrl = getApiBaseUrl();

          console.log('🔄 正在同步 Tauri 配置...', { apiUrl, hasToken: !!token });

          await invoke('set_api_config', {
            apiUrl,  // Tauri 自动转换：JS 用 camelCase，Rust 用 snake_case
            token,
          });

          console.log('✅ Tauri 配置已同步成功');
        } catch (error) {
          console.error('❌ 同步 Tauri 配置失败:', error);
        }
      } else {
        // 登出时清除配置
        try {
          console.log('🧹 正在清除 Tauri 配置...');

          await invoke('clear_api_config');

          console.log('✅ Tauri 配置已清除');
        } catch (error) {
          console.error('❌ 清除 Tauri 配置失败:', error);
        }
      }
    };

    syncConfig();
  }, [isAuthenticated, token]);
}
