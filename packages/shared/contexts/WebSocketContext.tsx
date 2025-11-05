'use client';

/**
 * WebSocket Context - 在应用中共享 WebSocket 连接
 */
import { createContext, useContext, ReactNode } from 'react';
import type { ClipboardSyncData } from '../types';

interface WebSocketContextType {
  isConnected: boolean;
  reconnect?: () => void;
  syncClipboard: (data: ClipboardSyncData) => boolean;
  getOnlineDevices: () => boolean;
  writeToClipboard?: (
    content: string,
    contentType?: 'text' | 'image' | 'file',
    metadata?: { fileName?: string; mimeType?: string }
  ) => Promise<void>;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within WebSocketProvider');
  }
  return context;
}

export const WebSocketProvider = WebSocketContext.Provider;
