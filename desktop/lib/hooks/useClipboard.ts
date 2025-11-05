/**
 * 剪贴板监听 Hook
 * 基于 tauri-plugin-clipboard-x-api 实现剪贴板内容变化监听
 */
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  type ClipboardChangeOptions,
  onClipboardChange,
  startListening,
  writeText,
  writeImage,
  writeFiles,
} from 'tauri-plugin-clipboard-x-api';
import { fullName } from 'tauri-plugin-fs-pro-api';
import { readFile } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';
import { cacheDir } from '@tauri-apps/api/path';
import { fileApi } from '@cloudpaste/shared/lib/api';
import type { ClipboardSyncData } from '@cloudpaste/shared/types';
import { getApiBaseUrl } from '@cloudpaste/shared/lib/apiConfig';
import { useAuthStore } from '@cloudpaste/shared/store/useAuthStore';
import { useSettingsStore } from '@cloudpaste/shared/store/useSettingsStore';

interface UseClipboardOptions extends ClipboardChangeOptions {
  /**
   * 是否自动上传到服务器
   * @default true
   */
  autoUpload?: boolean;
  
  /**
   * 是否显示通知
   * @default true
   */
  showNotification?: boolean;
  
  /**
   * WebSocket 同步函数
   */
  syncClipboard?: (data: ClipboardSyncData) => boolean;
}

export function useClipboard(options?: UseClipboardOptions): {
  writeToClipboard: (
    content: string,
    contentType?: 'text' | 'image' | 'file',
    metadata?: { fileName?: string; mimeType?: string }
  ) => Promise<void>;
} {
  const token = useAuthStore((state) => state.token); // 获取认证 token
  const { uploadSettings, shouldUploadFile } = useSettingsStore(); // 获取上传设置
  const lastContentRef = useRef<string>(''); // 保存上次内容的 hash
  const processingRef = useRef<boolean>(false); // 防止并发处理
  const isFromSyncRef = useRef<boolean>(false); // 标记是否来自 WebSocket 同步，防止循环触发
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null); // 防抖定时器
  const syncLockTimerRef = useRef<NodeJS.Timeout | null>(null); // 同步锁定定时器
  
  const {
    autoUpload: optionsAutoUpload,
    showNotification = true,
    syncClipboard,
    ...clipboardOptions
  } = options || {};
  
  // 优先使用 options 中的 autoUpload，否则使用 settings 中的配置
  const autoUpload = optionsAutoUpload !== undefined ? optionsAutoUpload : uploadSettings.autoUpload;

  // 构建文件完整 URL（使用登录时保存的 API 地址）
  const buildFileUrl = (fileIdOrUrl: string): string => {
    const apiBaseUrl = getApiBaseUrl();
    
    // 如果已经是完整 URL（包含协议），直接返回
    if (fileIdOrUrl.startsWith('http://') || fileIdOrUrl.startsWith('https://')) {
      return fileIdOrUrl;
    }
    
    // 如果是相对路径（以 /api/ 开头），拼接 base URL
    if (fileIdOrUrl.startsWith('/api/')) {
      return `${apiBaseUrl}${fileIdOrUrl}`;
    }
    
    // 否则是文件 ID，拼接完整路径
    return `${apiBaseUrl}/api/v1/files/download/${fileIdOrUrl}`;
  };

  // 计算内容 hash - 改进版本，参考 EcoPaste
  const getContentHash = async (result: any): Promise<string> => {
    const { files, image, html, rtf, text } = result;
    
    if (files) {
      // 文件类型：使用文件路径列表的 JSON 字符串
      return `files:${JSON.stringify(files.value)}`;
    }
    if (image) {
      // 图片类型：使用完整文件路径作为唯一标识
      try {
        const imagePath = await fullName(image.value);
        return `image:${imagePath}`;
      } catch (error) {
        // 如果获取路径失败，使用原始值的部分内容
        const sample = Array.isArray(image.value) 
          ? image.value.slice(0, 100).join(',')
          : String(image.value).substring(0, 100);
        return `image:${sample}`;
      }
    }
    if (html) {
      return `html:${html.value}`;
    }
    if (rtf) {
      return `rtf:${rtf.value}`;
    }
    if (text) {
      return `text:${text.value}`;
    }
    return '';
  };

  useEffect(() => {
    let isListening = false;

    const setupClipboardListener = async () => {
      try {
        console.log('🎧 启动剪贴板监听...');
        
        // 启动监听
        await startListening();
        isListening = true;

        // 注册剪贴板变化回调
        onClipboardChange(async (result) => {
          const { files, image, html, rtf, text } = result;

          console.log('📋 检测到剪贴板变化:', { 
            hasFiles: !!files, 
            hasImage: !!image, 
            hasHtml: !!html, 
            hasRtf: !!rtf, 
            hasText: !!text,
            isFromSync: isFromSyncRef.current
          });

          // 优先检查是否为空 - 参考 EcoPaste 的实现
          const isEmpty = !result || Object.values(result).every(v => !v || (v && 'value' in v && !v.value));

          if (isEmpty) {
            console.log('⚠️ 剪贴板内容为空，跳过防抖直接返回');
            return;
          }

          // 如果是来自 WebSocket 同步的内容，忽略本次触发，防止循环
          // 注意：不要立即重置标志，而是清除防抖计时器后返回，让标志在稍后自动清除
          if (isFromSyncRef.current) {
            console.log('⏭️ 来自 WebSocket 同步，跳过处理');
            // 清除之前的防抖定时器
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
            }
            // 延迟重置标志，确保所有可能的事件都已处理
            setTimeout(() => {
              isFromSyncRef.current = false;
              console.log('✅ 同步标志已重置');
            }, 1000); // 1秒后重置，确保所有延迟事件都已处理
            return;
          }

          // 防止并发处理
          if (processingRef.current) {
            console.log('⏭️ 正在处理中，跳过此次事件');
            return;
          }

          // 计算当前内容的 hash
          const contentHash = await getContentHash(result);

          // 检查是否与上次内容相同
          if (contentHash === lastContentRef.current) {
            console.log('⏭️ 内容与上次相同，跳过处理');
            return;
          }

          // 清除之前的防抖定时器
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            console.log('⏱️ 清除之前的防抖定时器');
          }

          // 只有在内容不为空时才使用防抖，避免空数据时的延迟
          // 使用防抖，延迟 300ms 处理，避免同一次复制操作触发多次事件
          debounceTimerRef.current = setTimeout(async () => {
            console.log('🚀 开始处理剪贴板内容');
            processingRef.current = true;
            
            // 标记本次处理是否成功
            let processSuccess = false;

          // 处理不同类型的剪贴板内容
          try {
            if (files) {
              // 文件类型
              console.log('📁 检测到文件:', files.value);
              
              if (showNotification) {
                toast.success(`检测到 ${files.value.length} 个文件`);
              }

              if (autoUpload) {
                // 遍历所有文件并上传
                for (const filePath of files.value) {
                  try {
                    console.log('📂 处理文件:', filePath);
                    
                    // 获取文件名和大小
                    const fileName = filePath.split('/').pop() || 'unknown-file';
                    
                    // 读取文件内容
                    const fileContent = await readFile(filePath);
                    const fileSizeBytes = fileContent.length;
                    console.log('✅ 文件读取成功，大小:', fileSizeBytes, 'bytes');
                    
                    // 检查文件是否应该上传
                    const uploadCheck = shouldUploadFile(fileName, fileSizeBytes);
                    if (!uploadCheck.allowed) {
                      console.log('⏭️ 跳过文件上传:', uploadCheck.reason);
                      if (showNotification) {
                        toast.warning(`跳过: ${fileName} - ${uploadCheck.reason}`);
                      }
                      continue;
                    }
                    
                    // 获取 MIME 类型（简单判断）
                    const ext = fileName.split('.').pop()?.toLowerCase() || '';
                    let mimeType = 'application/octet-stream';
                    if (ext === 'pdf') mimeType = 'application/pdf';
                    else if (ext === 'txt') mimeType = 'text/plain';
                    else if (ext === 'json') mimeType = 'application/json';
                    else if (ext === 'zip') mimeType = 'application/zip';
                    else if (ext === 'png') mimeType = 'image/png';
                    else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
                    else if (ext === 'gif') mimeType = 'image/gif';
                    else if (ext === 'mp4') mimeType = 'video/mp4';
                    else if (ext === 'mp3') mimeType = 'audio/mpeg';
                    
                    // 创建 Blob 和 File 对象
                    const fileBlob = new Blob([fileContent], { type: mimeType });
                    const file = new File([fileBlob], fileName, { type: mimeType });
                    
                    const deviceId = await invoke<string>('get_device_id_command');
                    const deviceName = await invoke<string>('get_device_name_command');
                    
                    console.log('⬆️ 开始上传文件:', fileName, file.size, 'bytes');
                    
                    // 上传文件
                    const uploadResponse = await fileApi.upload(file, deviceId);
                    
                    // 通过 WebSocket 同步到其他设备
                    if (syncClipboard) {
                      const success = syncClipboard({
                        content: uploadResponse.data.file_url,
                        content_type: uploadResponse.data.content_type,
                        device_id: deviceId,
                        device_name: deviceName,
                        file_name: uploadResponse.data.file_name,
                        file_size: uploadResponse.data.file_size,
                        mime_type: uploadResponse.data.mime_type,
                      });
                      
                      if (success && showNotification) {
                        // toast.success(`文件 ${fileName} 已自动上传`);
                      }
                    }
                  } catch (error) {
                    console.error('❌ 上传文件失败:', filePath, error);
                    if (showNotification) {
                      toast.error(`上传文件失败: ${filePath.split('/').pop()}`);
                    }
                  }
                }
              }
              
            } else if (image) {
              // 图片类型
              console.log('🖼️ 检测到图片', {
                type: typeof image.value,
                isArray: Array.isArray(image.value),
                length: image.value?.length,
                sample: image.value?.slice?.(0, 10)
              });
              
              if (showNotification) {
                // toast.success('检测到图片剪贴板');
              }

              if (autoUpload) {
                // 获取完整文件路径
                const imagePath = await fullName(image.value);
                const fileName = imagePath ? imagePath.split('/').pop() || 'clipboard-image.png' : 'clipboard-image.png';
                
                console.log('📝 图片文件名:', fileName, '原始路径:', imagePath);
                
                // 将图片数据转换为 Blob
                let imageBlob: Blob;
                
                if (typeof image.value === 'string' && (image.value.startsWith('/') || image.value.startsWith('file://'))) {
                  // 如果是文件路径，使用 Tauri 文件系统 API 读取文件内容
                  console.log('📂 从文件路径读取图片:', image.value);
                  try {
                    const filePath = image.value.startsWith('file://') ? image.value.slice(7) : image.value;
                    console.log('📖 读取文件:', filePath);
                    
                    // 使用重试机制读取文件，处理大文件写入延迟的情况
                    let fileContent: Uint8Array | null = null;
                    const maxRetries = 1;
                    const retryDelay = 100; // 每次重试间隔 100ms
                    
                    for (let attempt = 1; attempt <= maxRetries; attempt++) {
                      fileContent = await readFile(filePath);
                      console.log(`📖 第 ${attempt} 次读取，文件大小:`, fileContent.length, 'bytes');
                      
                      // 如果文件不为空，跳出重试循环
                      if (fileContent.length > 0) {
                        break;
                      }
                      
                      // 如果文件为空且还有重试机会，等待后重试
                      if (attempt < maxRetries) {
                        console.log(`⏳ 文件为空，${retryDelay}ms 后重试...`);
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                      }
                    }
                    
                    if (!fileContent || fileContent.length === 0) {
                      console.error('❌ 多次重试后文件仍为空');
                      // toast.error('图片文件为空或未就绪');
                      return;
                    }
                    
                    console.log('✅ 文件读取成功，大小:', fileContent.length, 'bytes');
                    
                    // 转换为 Blob（创建新的 Uint8Array 以确保类型兼容）
                    imageBlob = new Blob([new Uint8Array(fileContent)], { type: 'image/png' });
                  } catch (error) {
                    console.error('❌ 读取文件失败:', error);
                    toast.error('读取图片文件失败');
                    return;
                  }
                } else if (typeof image.value === 'string' && image.value.includes('base64')) {
                  // 如果是 base64 字符串
                  console.log('🔤 解码 base64 图片数据');
                  const base64Data = image.value.replace(/^data:image\/\w+;base64,/, '');
                  const binaryString = atob(base64Data);
                  const bytes = new Uint8Array(binaryString.length);
                  for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }
                  imageBlob = new Blob([bytes], { type: 'image/png' });
                } else {
                  // 如果是字节数组
                  console.log('🔢 处理字节数组图片数据');
                  const uint8Array = Array.isArray(image.value)
                    ? new Uint8Array(image.value as number[])
                    : new Uint8Array(image.value as any);
                  imageBlob = new Blob([uint8Array.buffer], { type: 'image/png' });
                }
                
                console.log('📦 图片 Blob 大小:', imageBlob.size, 'bytes');
                
                if (imageBlob.size === 0) {
                  console.error('❌ 图片数据为空');
                  toast.error('图片数据为空');
                  return;
                }
                
                // 检查图片是否应该上传
                const uploadCheck = shouldUploadFile(fileName, imageBlob.size);
                if (!uploadCheck.allowed) {
                  console.log('⏭️ 跳过图片上传:', uploadCheck.reason);
                  if (showNotification) {
                    toast.warning(`跳过图片上传 - ${uploadCheck.reason}`);
                  }
                  return;
                }

                const file = new File([imageBlob], fileName, { 
                  type: imageBlob.type || 'image/png'
                });

                const deviceId = await invoke<string>('get_device_id_command');
                const deviceName = await invoke<string>('get_device_name_command');

                console.log('⬆️ 开始上传图片:', fileName, file.size, 'bytes');

                // 上传图片文件
                const uploadResponse = await fileApi.upload(file, deviceId);
                
                // 通过 WebSocket 同步到其他设备
                if (syncClipboard) {
                  const success = syncClipboard({
                    content: uploadResponse.data.file_url,
                    content_type: uploadResponse.data.content_type,
                    device_id: deviceId,
                    device_name: deviceName,
                    file_name: uploadResponse.data.file_name,
                    file_size: uploadResponse.data.file_size,
                    mime_type: uploadResponse.data.mime_type,
                  });

                  if (success && showNotification) {
                    // toast.success('图片已自动上传');
                  }
                }
              }
              
            } else if (html && !rtf) {
              // HTML 类型
              const htmlContent = html.value;
              console.log('🌐 检测到 HTML:', htmlContent.substring(0, 50));
              
              if (showNotification) {
                toast.success('检测到 HTML 内容');
              }

              if (autoUpload) {
                const deviceId = await invoke<string>('get_device_id_command');
                const deviceName = await invoke<string>('get_device_name_command');

                // 通过 WebSocket 同步 HTML 内容
                if (syncClipboard) {
                  const success = syncClipboard({
                    content: htmlContent,
                    content_type: 'text',
                    device_id: deviceId,
                    device_name: deviceName,
                  });

                  if (success && showNotification) {
                    toast.success('HTML 内容已自动上传');
                  }
                }
              }
              
            } else if (rtf) {
              // RTF 类型
              const rtfContent = rtf.value;
              console.log('📄 检测到 RTF:', rtfContent.substring(0, 50));
              
              if (showNotification) {
                // toast.success('检测到富文本内容');
              }

              if (autoUpload) {
                const deviceId = await invoke<string>('get_device_id_command');
                const deviceName = await invoke<string>('get_device_name_command');

                // 通过 WebSocket 同步 RTF 内容
                if (syncClipboard) {
                  const success = syncClipboard({
                    content: rtfContent,
                    content_type: 'text',
                    device_id: deviceId,
                    device_name: deviceName,
                  });

                  if (success && showNotification) {
                    toast.success('富文本已自动上传');
                  }
                }
              }
              
            } else if (text) {
              // 文本类型（优先级最低）
              const textContent = text.value;
              console.log('📝 检测到文本:', textContent.substring(0, 50));
              
              if (showNotification) {
                // toast.success(`检测到文本: ${textContent.substring(0, 30)}...`);
              }

              if (autoUpload) {
                const deviceId = await invoke<string>('get_device_id_command');
                const deviceName = await invoke<string>('get_device_name_command');

                // 通过 WebSocket 同步文本
                if (syncClipboard) {
                  const success = syncClipboard({
                    content: textContent,
                    content_type: 'text',
                    device_id: deviceId,
                    device_name: deviceName,
                  });

                  if (success && showNotification) {
                    // toast.success('文本已自动上传');
                  }
                }
              }
            }
              // 如果执行到这里没有 return，说明处理成功
              processSuccess = true;
            } catch (error) {
              console.error('❌ 处理剪贴板内容失败:', error);
              if (showNotification) {
                toast.error('上传剪贴板内容失败');
              }
            } finally {
              // 只有处理成功时才更新 lastContentRef，失败时保持原值以允许重试
              if (processSuccess) {
                lastContentRef.current = contentHash;
                console.log('✅ 处理成功，更新内容哈希');
              } else {
                console.log('⚠️ 处理失败，保持原哈希值以允许重试');
              }
              
              // 延迟重置处理标志，防止快速连续触发
              setTimeout(() => {
                processingRef.current = false;
                console.log('✅ 处理完成，重置标志');
              }, 500);
            }
          }, 300); // 防抖延迟 300ms
        }, clipboardOptions);

        console.log('✅ 剪贴板监听已启动');
      } catch (error) {
        console.error('❌ 启动剪贴板监听失败:', error);
        if (showNotification) {
          toast.error('启动剪贴板监听失败');
        }
      }
    };

    setupClipboardListener();

    // 清理函数
    return () => {
      if (isListening) {
        console.log('🧹 停止剪贴板监听');
        // 清理防抖定时器
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        // 清理同步锁定定时器
        if (syncLockTimerRef.current) {
          clearTimeout(syncLockTimerRef.current);
        }
        // tauri-plugin-clipboard-x-api 会自动清理监听器
      }
    };
  }, []); // 只在组件挂载时启动一次，避免重复启动导致频繁触发

  // 导出写入剪贴板的函数，供外部使用（如 WebSocket 同步）
  const writeToClipboard = async (
    content: string,
    contentType?: 'text' | 'image' | 'file',
    metadata?: { fileName?: string; mimeType?: string }
  ) => {
    try {
      // 设置标志，表明下一次剪贴板变化来自同步
      isFromSyncRef.current = true;

      if (contentType === 'image') {
        // 处理图片类型
        console.log('🖼️ 写入图片到剪贴板:', content.substring(0, 50));

        // 构建完整 URL
        const imageUrl = buildFileUrl(content);
        console.log('📡 完整图片 URL:', imageUrl);

        // 下载图片到临时文件（带认证 token）
        const response = await fetch(imageUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        console.log('📡 响应状态:', response.status, response.statusText);
        console.log('📋 响应 Content-Type:', response.headers.get('content-type'));

        if (!response.ok) {
          throw new Error(`下载图片失败: ${response.status} ${response.statusText}`);
        }

        const blob = await response.blob();
        console.log('📦 Blob 类型:', blob.type, '大小:', blob.size, 'bytes');

        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // 验证数据不为空
        if (uint8Array.length === 0) {
          throw new Error('下载的图片数据为空');
        }

        // 检查是否是 HTML 或 JSON 错误响应
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/html') || contentType.includes('application/json')) {
          const textData = new TextDecoder().decode(uint8Array.slice(0, 200));
          console.error('❌ 下载的不是图片数据:', textData);
          throw new Error(`服务器返回了非图片数据: ${contentType}`);
        }

        // 检查图片文件签名
        const signature = Array.from(uint8Array.slice(0, 8))
          .map(b => b.toString(16).padStart(2, '0'))
          .join(' ');
        console.log('📸 图片文件头签名:', signature);

        // PNG 签名: 89 50 4E 47 0D 0A 1A 0A
        // JPEG 签名: FF D8 FF
        // GIF 签名: 47 49 46 38
        const isPNG = uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && uint8Array[2] === 0x4E && uint8Array[3] === 0x47;
        const isJPEG = uint8Array[0] === 0xFF && uint8Array[1] === 0xD8 && uint8Array[2] === 0xFF;
        const isGIF = uint8Array[0] === 0x47 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46;

        console.log('🔍 图片格式检测:', { isPNG, isJPEG, isGIF });

        // 生成临时文件名和路径
        // 优先使用原始文件名，否则根据实际文件签名确定扩展名
        let fileName = metadata?.fileName;
        if (!fileName) {
          // 根据实际文件签名确定扩展名
          let ext = 'png';
          if (isJPEG) {
            ext = 'jpg';
          } else if (isGIF) {
            ext = 'gif';
          } else if (isPNG) {
            ext = 'png';
          } else {
            // 如果无法识别签名，尝试使用 mimeType
            const mimeType = metadata?.mimeType || blob.type || 'image/png';
            console.log('⚠️ 无法识别文件签名，使用 MIME 类型:', mimeType);
            if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
              ext = 'jpg';
            } else if (mimeType.includes('gif')) {
              ext = 'gif';
            } else if (mimeType.includes('webp')) {
              ext = 'webp';
            } else if (mimeType.includes('bmp')) {
              ext = 'bmp';
            }
          }
          fileName = `clipboard_image_${Date.now()}.${ext}`;
        }

        const tempDir = await cacheDir();
        const clipboardCacheDir = `${tempDir}/cloudpaste`;
        const tempFilePath = `${clipboardCacheDir}/${fileName}`;

        console.log('💾 图片数据大小:', uint8Array.length, 'bytes');
        console.log('📝 保存到:', tempFilePath);
        console.log('📋 MIME 类型:', metadata?.mimeType || blob.type);
        console.log('📄 文件名:', fileName);

        // 确保目录存在
        const { writeFile, mkdir } = await import('@tauri-apps/plugin-fs');
        try {
          await mkdir(clipboardCacheDir, { recursive: true });
          console.log('📁 确保目录存在:', clipboardCacheDir);
        } catch (error) {
          // 目录已存在，忽略错误
          console.log('📁 目录已存在:', clipboardCacheDir);
        }

        // 保存图片到临时文件
        await writeFile(tempFilePath, uint8Array);

        // 锁定处理标志，防止剪贴板监听器触发上传
        // 在写入剪贴板期间和之后的2秒内，阻止任何自动上传
        processingRef.current = true;
        console.log('🔒 锁定剪贴板处理（同步写入）');

        // 写入剪贴板（writeImage 接受图片文件路径）
        await writeImage(tempFilePath);

        console.log('✅ 图片已写入剪贴板');

        // 延迟解锁，确保所有可能触发的剪贴板事件都被忽略
        if (syncLockTimerRef.current) {
          clearTimeout(syncLockTimerRef.current);
        }
        syncLockTimerRef.current = setTimeout(() => {
          processingRef.current = false;
          console.log('🔓 解锁剪贴板处理（同步完成）');
        }, 2000); // 2秒后解锁
        
      } else if (contentType === 'file') {
        // 处理文件类型
        console.log('📁 写入文件到剪贴板:', metadata?.fileName || content.substring(0, 50));
        
        // 构建完整 URL
        const fileUrl = buildFileUrl(content);
        console.log('📡 完整文件 URL:', fileUrl);
        
        // 下载文件到临时目录（带认证 token）
        const response = await fetch(fileUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          throw new Error(`下载文件失败: ${response.status}`);
        }
        
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // 生成临时文件名和路径
        const fileName = metadata?.fileName || `clipboard_file_${Date.now()}`;
        const tempDir = await cacheDir();
        const clipboardCacheDir = `${tempDir}/cloudpaste`;
        const tempFilePath = `${clipboardCacheDir}/${fileName}`;
        
        console.log('💾 文件数据大小:', uint8Array.length, 'bytes');
        console.log('📝 保存到:', tempFilePath);
        
        // 确保目录存在
        const { writeFile, mkdir } = await import('@tauri-apps/plugin-fs');
        try {
          await mkdir(clipboardCacheDir, { recursive: true });
          console.log('📁 确保目录存在:', clipboardCacheDir);
        } catch (error) {
          // 目录已存在，忽略错误
          console.log('📁 目录已存在:', clipboardCacheDir);
        }
        
        // 保存文件到临时目录
        await writeFile(tempFilePath, uint8Array);

        // 锁定处理标志，防止剪贴板监听器触发上传
        processingRef.current = true;
        console.log('🔒 锁定剪贴板处理（同步写入）');

        // 将文件路径写入剪贴板（writeFiles 接受文件路径数组）
        await writeFiles([tempFilePath]);

        console.log('✅ 文件已写入剪贴板');

        // 延迟解锁
        if (syncLockTimerRef.current) {
          clearTimeout(syncLockTimerRef.current);
        }
        syncLockTimerRef.current = setTimeout(() => {
          processingRef.current = false;
          console.log('🔓 解锁剪贴板处理（同步完成）');
        }, 2000);
        
      } else {
        // 处理文本类型
        console.log('📝 写入文本到剪贴板:', content.substring(0, 50));

        // 锁定处理标志，防止剪贴板监听器触发上传
        processingRef.current = true;
        console.log('🔒 锁定剪贴板处理（同步写入）');

        await writeText(content);
        console.log('✅ 文本已写入剪贴板');

        // 延迟解锁
        if (syncLockTimerRef.current) {
          clearTimeout(syncLockTimerRef.current);
        }
        syncLockTimerRef.current = setTimeout(() => {
          processingRef.current = false;
          console.log('🔓 解锁剪贴板处理（同步完成）');
        }, 2000);
      }
      
    } catch (error) {
      console.error('❌ 写入剪贴板失败:', error);

      // 发生错误时立即解锁，允许后续操作
      processingRef.current = false;
      if (syncLockTimerRef.current) {
        clearTimeout(syncLockTimerRef.current);
        syncLockTimerRef.current = null;
      }

      // 延迟重置同步标志
      setTimeout(() => {
        isFromSyncRef.current = false;
        console.log('✅ 同步标志已重置（错误处理）');
      }, 1000);

      throw error;
    }
  };

  return { writeToClipboard };
}
