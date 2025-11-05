import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

/**
 * 更新进度状态
 */
export interface UpdateProgress {
  show: boolean;
  downloaded: number;
  total: number;
  status: "" | "downloading" | "installing" | "done";
}

/**
 * 更新管理器
 * 负责应用的更新检查、下载和安装
 */
export class UpdateManager {
  private updateProgress: UpdateProgress;
  private listeners: Set<(progress: UpdateProgress) => void>;

  constructor() {
    this.updateProgress = {
      show: false,
      downloaded: 0,
      total: 0,
      status: ""
    };
    this.listeners = new Set();
  }

  /**
   * 订阅更新进度变化
   * @param listener 监听器函数
   * @returns 取消订阅函数
   */
  subscribe(listener: (progress: UpdateProgress) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 通知所有监听器
   */
  private notify(): void {
    this.listeners.forEach(listener => listener(this.updateProgress));
  }

  /**
   * 更新进度状态
   * @param newProgress 新的进度状态
   */
  private setProgress(newProgress: Partial<UpdateProgress>): void {
    this.updateProgress = { ...this.updateProgress, ...newProgress };
    this.notify();
  }

  /**
   * 检查更新
   * @returns 更新信息或 null（无更新）
   */
  async checkForUpdates() {
    try {
      const update = await check();
      return update;
    } catch (error) {
      console.error("检查更新失败:", error);
      throw error;
    }
  }

  /**
   * 下载并安装更新
   * @param update 更新对象
   * @param onProgress 进度回调（可选）
   */
  async downloadAndInstall(update: any, onProgress?: (event: any) => void): Promise<boolean> {
    try {
      this.setProgress({ show: true, downloaded: 0, total: 0, status: "downloading" });

      await update.downloadAndInstall((event: any) => {
        if (event.event === "Started") {
          this.setProgress({
            show: true,
            downloaded: 0,
            total: event.data.contentLength,
            status: "downloading"
          });
        } else if (event.event === "Progress") {
          this.setProgress({
            downloaded: this.updateProgress.downloaded + event.data.chunkLength
          });
        } else if (event.event === "Finished") {
          this.setProgress({ status: "installing" });
        }

        // 调用外部进度回调
        if (onProgress) {
          onProgress(event);
        }
      });

      this.setProgress({ status: "done" });
      return true;
    } catch (error) {
      this.setProgress({ show: false, downloaded: 0, total: 0, status: "" });
      throw error;
    }
  }

  /**
   * 关闭更新进度对话框
   */
  closeProgress(): void {
    this.setProgress({ show: false, downloaded: 0, total: 0, status: "" });
  }

  /**
   * 重启应用
   */
  async restartApp(): Promise<void> {
    try {
      await relaunch();
    } catch (error) {
      console.error("重启应用失败:", error);
      throw error;
    }
  }

  /**
   * 获取当前进度
   * @returns 当前进度对象
   */
  getProgress(): UpdateProgress {
    return { ...this.updateProgress };
  }

  /**
   * 格式化文件大小
   * @param bytes 字节数
   * @returns 格式化后的大小
   */
  static formatSize(bytes: number): string {
    return (bytes / 1024 / 1024).toFixed(2) + " MB";
  }

  /**
   * 计算下载进度百分比
   * @param downloaded 已下载字节数
   * @param total 总字节数
   * @returns 百分比字符串
   */
  static calculateProgress(downloaded: number, total: number): string {
    if (total === 0) return "0.0";
    return ((downloaded / total) * 100).toFixed(1);
  }
}

// 导出单例实例
export const updateManager = new UpdateManager();
