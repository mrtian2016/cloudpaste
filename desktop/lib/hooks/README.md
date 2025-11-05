# Hooks 使用说明

## useClipboard - 剪贴板监听 Hook

基于 `tauri-plugin-clipboard-x-api` 实现的剪贴板内容变化监听 Hook。

### 功能特性

- ✅ 自动监听剪贴板变化
- ✅ 支持多种内容类型：文本、图片、HTML、RTF、文件
- ✅ 自动上传到服务器
- ✅ 通过 WebSocket 实时同步到其他设备
- ✅ 可配置的通知提示

### 使用方法

```tsx
import { useClipboard } from '@/lib/hooks/useClipboard';

function MyComponent() {
  // 基础使用 - 启用所有默认功能
  useClipboard();

  // 自定义配置
  useClipboard({
    autoUpload: true,        // 是否自动上传到服务器 (默认: true)
    showNotification: true,  // 是否显示通知 (默认: true)
  });

  return <div>My Component</div>;
}
```

### 支持的剪贴板类型

1. **文本 (Text)**
   - 自动检测并上传纯文本内容
   - 通过 WebSocket 同步到其他设备

2. **图片 (Image)**
   - 将图片数据转换为 PNG 格式
   - 自动上传到文件服务器
   - 创建剪贴板记录并同步

3. **HTML**
   - 保留 HTML 格式的富文本内容
   - 作为文本类型上传

4. **RTF (Rich Text Format)**
   - 保留 RTF 格式的富文本内容
   - 作为文本类型上传

5. **文件 (Files)**
   - 检测文件路径
   - TODO: 实现文件上传逻辑

### 工作原理

1. Hook 在组件挂载时启动剪贴板监听
2. 当检测到剪贴板变化时，触发回调函数
3. 根据内容类型进行不同的处理：
   - 文本/HTML/RTF: 直接上传内容
   - 图片: 转换为文件后上传
   - 文件: 读取文件路径（待实现）
4. 上传成功后通过 WebSocket 同步到其他设备
5. 显示通知提示用户

### 注意事项

- 仅在 Tauri 环境中生效（使用 `isTauriApp()` 方法检测）
- 需要配合 `useWebSocketContext` 使用以实现设备间同步
- 需要用户已登录并配置好 API 地址和 Token
- 文件类型的上传功能尚未完全实现

### 参考实现

本 Hook 参考了 [EcoPaste](https://github.com/EcoPasteHub/EcoPaste) 项目的剪贴板监听实现。
