/**
 * WebSocket Hook - 包含自动重连机制
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import type { WebSocketMessage, ClipboardSyncData, OnlineDevice } from '../types';
import { generateDeviceId, getDeviceName } from '../lib/utils';
import { getApiBaseUrl } from '../lib/apiConfig';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onConnected?: (data: any) => void;
  onDisconnected?: () => void;
  onClipboardSync?: (data: ClipboardSyncData) => void;
  onTimestampUpdated?: (data: any) => void;
  onDeviceOffline?: (deviceId: string) => void;
  onError?: (error: Event) => void;
  autoConnect?: boolean;
  reconnectInterval?: number; // 重连间隔（毫秒）
  maxReconnectAttempts?: number; // 最大重连次数，0 表示无限重连
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    onMessage,
    onConnected,
    onDisconnected,
    onClipboardSync,
    onTimestampUpdated,
    onDeviceOffline,
    onError,
    autoConnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 0, // 默认无限重连
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isManualCloseRef = useRef(false);
  const isMountedRef = useRef(true);

  // 使用 ref 存储回调函数，避免依赖项变化导致重连
  const callbacksRef = useRef({
    onMessage,
    onConnected,
    onDisconnected,
    onClipboardSync,
    onTimestampUpdated,
    onDeviceOffline,
    onError,
  });

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [onlineDevices, setOnlineDevices] = useState<OnlineDevice[]>([]);
  const [showDisconnectAlert, setShowDisconnectAlert] = useState(false);
  const notificationPermissionRef = useRef(false);

  // 更新回调函数的 ref
  useEffect(() => {
    callbacksRef.current = {
      onMessage,
      onConnected,
      onDisconnected,
      onClipboardSync,
      onTimestampUpdated,
      onDeviceOffline,
      onError,
    };
  }, [onMessage, onConnected, onDisconnected, onClipboardSync, onTimestampUpdated, onDeviceOffline, onError]);

  // 获取 WebSocket URL
  const getWebSocketUrl = useCallback(() => {
    const token = localStorage.getItem('access_token');
    const deviceId = generateDeviceId();
    const deviceName = encodeURIComponent(getDeviceName());

    // 构建 WebSocket URL
    let wsHost: string;
    let wsProtocol: string;

    // 从 API 配置中获取基础 URL
    const apiBaseUrl = getApiBaseUrl();

    // 如果有完整的 API 地址配置（开发环境或自定义配置）
    if (apiBaseUrl) {
      try {
        const apiUrl = new URL(apiBaseUrl);
        // 移除路径中的 /api/v1 后缀（如果存在）
        const cleanHost = apiUrl.host;
        wsHost = cleanHost;
        wsProtocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      } catch (error) {
        console.warn('解析 API URL 失败:', error);
        // 降级到当前访问地址
        wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsHost = window.location.host;
      }
    } else {
      // 生产环境：使用当前访问的地址（适配 nginx 反向代理）
      wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsHost = window.location.host;
    }

    let url = `${wsProtocol}//${wsHost}/api/v1/ws?device_id=${deviceId}&device_name=${deviceName}`;

    if (token) {
      url += `&token=${token}`;
    }

    console.log('WebSocket URL:', url);
    return url;
  }, []);

  // 请求通知权限
  const requestNotificationPermission = useCallback(async () => {
    try {
      let permissionGranted = await isPermissionGranted();

      if (!permissionGranted) {
        const permission = await requestPermission();
        permissionGranted = permission === 'granted';
      }

      notificationPermissionRef.current = permissionGranted;
      return permissionGranted;
    } catch (error) {
      console.error('请求通知权限失败:', error);
      return false;
    }
  }, []);

  // 发送断开连接通知
  const sendDisconnectNotification = useCallback(async () => {
    try {
      if (!notificationPermissionRef.current) {
        await requestNotificationPermission();
      }

      if (notificationPermissionRef.current) {
        await sendNotification({
          title: '剪贴板同步已断开',
          body: '正在尝试重新连接服务器，请检查网络连接...',
        });
      }
    } catch (error) {
      console.error('发送通知失败:', error);
    }
  }, [requestNotificationPermission]);

  // 清除心跳定时器
  const clearHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // 启动心跳检测
  const startHeartbeat = useCallback(() => {
    clearHeartbeat();
    
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          action: 'ping',
          timestamp: Date.now(),
        }));
      }
    }, 30000); // 每 30 秒发送一次心跳
  }, [clearHeartbeat]);

  // 清除重连定时器
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // 连接 WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || 
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    try {
      setIsConnecting(true);
      const url = getWebSocketUrl();
      console.log('正在连接 WebSocket:', url);
      
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket 已连接');
        setIsConnected(true);
        setIsConnecting(false);
        setShowDisconnectAlert(false); // 连接成功，隐藏断线警告
        reconnectAttemptsRef.current = 0; // 重置重连次数
        startHeartbeat(); // 启动心跳
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('收到 WebSocket 消息:', message);

          // 调用通用消息处理器
          callbacksRef.current.onMessage?.(message);

          // 根据消息类型调用特定处理器
          switch (message.type) {
            case 'connected':
              callbacksRef.current.onConnected?.(message.data);
              if (message.data.online_devices) {
                setOnlineDevices(message.data.online_devices);
              }
              break;

            case 'clipboard_sync':  // 后端发送的是 clipboard_sync
              callbacksRef.current.onClipboardSync?.(message.data);
              break;

            case 'device_offline':
              callbacksRef.current.onDeviceOffline?.(message.data.device_id);
              break;

            case 'device_online':
              // 设备上线通知
              console.log('设备上线:', message.data);
              break;

            case 'online_devices':
              setOnlineDevices(message.data.devices || []);
              break;

            case 'pong':
              // 心跳响应
              break;

            case 'sync_confirmed':
              // 同步确认消息
              console.log('同步已确认:', message.data);
              break;

            case 'sync_skipped':
              // 同步跳过消息（重复内容）
              console.log('同步已跳过:', message.data);
              break;

            case 'timestamp_updated':
              // 时间戳更新消息（重复内容更新时间戳）
              console.log('时间戳已更新:', message.data);
              callbacksRef.current.onTimestampUpdated?.(message.data);
              break;

            default:
              console.log('未处理的消息类型:', message.type);
          }
        } catch (error) {
          console.error('解析 WebSocket 消息失败:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket 错误:', error);
        setIsConnecting(false);
        callbacksRef.current.onError?.(error);
      };

      ws.onclose = (event) => {
        console.log('WebSocket 已断开:', event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        clearHeartbeat();
        callbacksRef.current.onDisconnected?.();

        // 如果不是手动关闭，发送断开通知并显示应用内警告
        if (!isManualCloseRef.current) {
          setShowDisconnectAlert(true); // 显示应用内断线警告
          sendDisconnectNotification(); // 发送系统通知
        }

        // 如果不是手动关闭且组件仍然挂载，则尝试重连
        if (!isManualCloseRef.current && isMountedRef.current) {
          const shouldReconnect = maxReconnectAttempts === 0 ||
                                  reconnectAttemptsRef.current < maxReconnectAttempts;

          if (shouldReconnect) {
            reconnectAttemptsRef.current++;
            console.log(`将在 ${reconnectInterval}ms 后重连 (第 ${reconnectAttemptsRef.current} 次尝试)`);

            clearReconnectTimeout();
            reconnectTimeoutRef.current = setTimeout(() => {
              if (isMountedRef.current) {
                connect();
              }
            }, reconnectInterval);
          } else {
            console.log('已达到最大重连次数，停止重连');
          }
        } else {
          isManualCloseRef.current = false; // 重置标志
        }
      };
    } catch (error) {
      console.error('创建 WebSocket 连接失败:', error);
      setIsConnecting(false);
    }
  }, [
    getWebSocketUrl,
    reconnectInterval,
    maxReconnectAttempts,
    startHeartbeat,
    clearHeartbeat,
    clearReconnectTimeout,
    sendDisconnectNotification,
  ]);

  // 断开连接
  const disconnect = useCallback(() => {
    isManualCloseRef.current = true;
    clearReconnectTimeout();
    clearHeartbeat();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
  }, [clearReconnectTimeout, clearHeartbeat]);

  // 手动重连
  const reconnect = useCallback(() => {
    console.log('手动触发重连...');

    // 如果已经连接或正在连接，先断开
    if (wsRef.current) {
      isManualCloseRef.current = true; // 防止自动重连
      wsRef.current.close();
      wsRef.current = null;
    }

    // 清除所有定时器
    clearReconnectTimeout();
    clearHeartbeat();

    // 重置状态
    setIsConnected(false);
    setIsConnecting(false);
    reconnectAttemptsRef.current = 0;
    isManualCloseRef.current = false; // 重置标志以允许自动重连

    // 延迟一小段时间后重新连接，确保前一个连接已完全关闭
    setTimeout(() => {
      if (isMountedRef.current) {
        connect();
      }
    }, 100);
  }, [clearReconnectTimeout, clearHeartbeat, connect]);

  // 发送消息
  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
      return true;
    } else {
      console.warn('WebSocket 未连接，无法发送消息');
      return false;
    }
  }, []);

  // 同步剪贴板
  const syncClipboard = useCallback((data: ClipboardSyncData) => {
    return send({
      action: 'sync_clipboard',
      data,
    });
  }, [send]);

  // 获取在线设备
  const getOnlineDevices = useCallback(() => {
    return send({
      action: 'get_online_devices',
    });
  }, [send]);

  // 手动关闭断线警告
  const dismissDisconnectAlert = useCallback(() => {
    setShowDisconnectAlert(false);
  }, []);

  // 初始化：请求通知权限
  useEffect(() => {
    requestNotificationPermission();
  }, [requestNotificationPermission]);

  // 自动连接
  useEffect(() => {
    isMountedRef.current = true;

    if (autoConnect) {
      connect();
    }

    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    isConnected,
    isConnecting,
    onlineDevices,
    showDisconnectAlert,
    connect,
    disconnect,
    reconnect,
    send,
    syncClipboard,
    getOnlineDevices,
    dismissDisconnectAlert,
  };
}
