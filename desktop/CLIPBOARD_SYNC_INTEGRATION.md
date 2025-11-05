# 剪贴板同步集成指南

## 概述

Rust 后端已经实现了剪贴板监听和HTTP同步功能。需要在前端登录成功后调用 Tauri commands 设置 API 配置。

## Rust 后端功能

### 1. 全局 API 配置管理
- 使用全局静态变量 `GLOBAL_API_CONFIG` 管理配置
- 配置包含：`base_url`, `token`, `device_id`, `device_name`, `is_configured`

### 2. Tauri Commands

#### `set_api_config(api_url: String, token: String)`
设置 API 配置，在用户登录成功后调用。

#### `get_api_config_status() -> bool`
检查API配置状态。

#### `clear_api_config()`
清除 API 配置，在用户登出时调用。

### 3. 自动同步功能
- **文本同步**：检测到文本变化自动POST到 `/api/v1/clipboard/`
- **图片同步**：
  1. 上传图片到 `/api/v1/files/upload`
  2. 创建剪贴板记录到 `/api/v1/clipboard/`

## 前端集成步骤

### 1. 在登录成功后设置配置

修改 `desktop/app/login/page.tsx`：

```typescript
import { invoke } from '@tauri-apps/api/core';

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!validate()) return;

  setIsLoading(true);

  try {
    // 保存 API URL 配置
    setApiBaseUrl(formData.apiUrl);

    // 登录
    const tokenResponse = await authApi.login({
      username: formData.username,
      password: formData.password,
    });

    // 获取用户信息
    localStorage.setItem('access_token', tokenResponse.access_token);
    const user = await authApi.getCurrentUser();

    // 保存认证信息
    setAuth(user, tokenResponse.access_token);

    // 🆕 设置 Rust 后端 API 配置
    try {
      await invoke('set_api_config', {
        apiUrl: formData.apiUrl,
        token: tokenResponse.access_token
      });
      console.log('✅ Rust 后端配置已设置');
    } catch (error) {
      console.error('❌ 设置 Rust 配置失败:', error);
    }

    toast.success('登录成功！');

    // 跳转到主页
    router.push('/dashboard');
  } catch (error: any) {
    console.error('登录失败:', error);
    const message = error.response?.data?.detail || '登录失败，请检查配置和凭据';
    toast.error(message);
  } finally {
    setIsLoading(false);
  }
};
```

### 2. 创建配置同步 Hook

创建 `desktop/lib/hooks/useTauriConfig.ts`：

```typescript
import { invoke } from '@tauri-apps/api/core';
import { useEffect } from 'react';
import { useAuthStore } from '@syncclipboard/shared/store/useAuthStore';
import { getApiBaseUrl } from '@syncclipboard/shared/lib/apiConfig';

export function useTauriConfig() {
  const { token, isAuthenticated } = useAuthStore();

  useEffect(() => {
    const syncConfig = async () => {
      if (isAuthenticated && token) {
        try {
          const apiUrl = getApiBaseUrl();
          await invoke('set_api_config', {
            apiUrl,
            token
          });
          console.log('✅ Tauri 配置已同步');
        } catch (error) {
          console.error('❌ 同步 Tauri 配置失败:', error);
        }
      } else {
        // 登出时清除配置
        try {
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
```

### 3. 在根布局中使用 Hook

修改 `desktop/app/layout.tsx`：

```typescript
'use client';

import { useTauriConfig } from '@/lib/hooks/useTauriConfig';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // 同步配置到 Tauri 后端
  useTauriConfig();

  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

### 4. 在登出时清除配置

在登出逻辑中：

```typescript
import { invoke } from '@tauri-apps/api/core';

const handleLogout = async () => {
  try {
    // 清除 Tauri 配置
    await invoke('clear_api_config');

    // 清除前端状态
    clearAuth();

    router.push('/login');
  } catch (error) {
    console.error('登出失败:', error);
  }
};
```

## 工作流程

1. **用户登录**
   - 前端调用登录 API
   - 获取 access_token
   - 调用 `set_api_config(api_url, token)` 设置 Rust 配置

2. **剪贴板监听启动**
   - Tauri 应用启动时自动启动剪贴板监听
   - 监听器运行在后台线程

3. **检测到剪贴板变化**
   - 读取剪贴板内容（文本/图片）
   - 检查全局配置是否已设置
   - 如果已配置，自动调用 HTTP API 同步

4. **文本同步**
   ```
   剪贴板变化 -> 读取文本 -> POST /api/v1/clipboard/
   ```

5. **图片同步**
   ```
   剪贴板变化 -> 读取图片 -> 转换为PNG
   -> POST /api/v1/files/upload
   -> POST /api/v1/clipboard/ (包含file_id)
   ```

6. **用户登出**
   - 调用 `clear_api_config()` 清除配置
   - 后续剪贴板变化不再同步

## 注意事项

1. **Token 刷新**：如果实现了 token 刷新机制，需要在刷新后重新调用 `set_api_config`

2. **错误处理**：同步失败时只在控制台输出错误，不影响应用正常使用

3. **设备信息**：
   - `device_id`: 自动生成（格式：`desktop_<hostname>`）
   - `device_name`: 使用机器的 hostname

4. **API URL 格式**：
   - 前端传入完整 URL（如 `http://localhost:8000`）
   - Rust 自动添加 `/api/v1` 后缀

## 调试

查看 Rust 控制台输出：

```bash
# 开发模式运行
cd desktop
pnpm tauri dev

# 查看输出
✅ API 配置已更新: base_url=http://localhost:8000/api/v1, device_id=desktop_hostname
🔔 on_clipboard_change 回调被触发！
🎯 检测到文本变化: Hello World
✅ 文本同步成功: Hello World
```

## 测试步骤

1. 启动后端服务器
2. 启动 Tauri 应用：`pnpm tauri dev`
3. 登录账户
4. 复制一些文本或图片
5. 检查后端数据库是否有新记录
6. 检查其他设备是否收到 WebSocket 广播

## 完成状态

- ✅ Rust 后端剪贴板监听
- ✅ 文本同步到 HTTP API
- ✅ 图片上传和同步
- ✅ 全局配置管理
- ✅ Tauri Commands 导出
- ⏳ 前端集成代码（待实现）
