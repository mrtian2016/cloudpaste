/**
 * 设备信息统一获取工具
 * Desktop 应用统一使用 Tauri 命令获取设备信息
 */
import { invoke } from '@tauri-apps/api/core';

/**
 * 获取设备 ID
 * 使用 Tauri 命令获取真实的设备 ID
 */
export async function getDeviceId(): Promise<string> {
  try {
    return await invoke<string>('get_device_id_command');
  } catch (error) {
    console.error('获取设备 ID 失败:', error);
    // 降级方案：使用 localStorage
    const stored = localStorage.getItem('device_id');
    if (stored) return stored;

    const deviceId = `desktop_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('device_id', deviceId);
    return deviceId;
  }
}

/**
 * 获取设备名称
 * 使用 Tauri 命令获取真实的设备名称
 */
export async function getDeviceName(): Promise<string> {
  try {
    return await invoke<string>('get_device_name_command');
  } catch (error) {
    console.error('获取设备名称失败:', error);
    // 降级方案：使用 localStorage 或生成默认名称
    const stored = localStorage.getItem('device_name');
    if (stored) return stored;

    const platform = navigator.platform || 'Unknown';
    const deviceName = `Desktop (${platform})`;
    localStorage.setItem('device_name', deviceName);
    return deviceName;
  }
}
