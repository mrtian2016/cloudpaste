use log::{info, warn};
use reqwest;
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// 获取缓存目录路径
fn get_cache_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| format!("获取缓存目录失败: {}", e))?;

    let image_cache_dir = cache_dir.join("images");

    // 确保缓存目录存在
    fs::create_dir_all(&image_cache_dir).map_err(|e| format!("创建缓存目录失败: {}", e))?;

    Ok(image_cache_dir)
}

/// 根据 URL 生成缓存文件名（使用 SHA256 哈希）
fn get_cache_filename(url: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(url.as_bytes());
    let result = hasher.finalize();

    // 从 URL 中提取文件扩展名（移除查询参数）
    let url_without_query = url.split('?').next().unwrap_or(url);

    let extension = url_without_query
        .rsplit('/')
        .next()
        .and_then(|filename| filename.rsplit('.').next())
        .and_then(|ext| {
            let ext_lower = ext.to_lowercase();

            // 支持的文件扩展名列表
            match ext_lower.as_str() {
                // 图片
                "jpg" | "jpeg" => Some("jpg"),
                "png" => Some("png"),
                "gif" => Some("gif"),
                "webp" => Some("webp"),
                "bmp" => Some("bmp"),
                "svg" => Some("svg"),
                "ico" => Some("ico"),

                // 视频
                "mp4" => Some("mp4"),
                "avi" => Some("avi"),
                "mov" => Some("mov"),
                "mkv" => Some("mkv"),
                "webm" => Some("webm"),
                "flv" => Some("flv"),
                "wmv" => Some("wmv"),
                "m4v" => Some("m4v"),

                // 音频
                "mp3" => Some("mp3"),
                "wav" => Some("wav"),
                "ogg" => Some("ogg"),
                "flac" => Some("flac"),
                "m4a" => Some("m4a"),
                "aac" => Some("aac"),
                "wma" => Some("wma"),

                // 文档
                "pdf" => Some("pdf"),
                "txt" => Some("txt"),
                "doc" => Some("doc"),
                "docx" => Some("docx"),
                "xls" => Some("xls"),
                "xlsx" => Some("xlsx"),
                "ppt" => Some("ppt"),
                "pptx" => Some("pptx"),
                "csv" => Some("csv"),
                "json" => Some("json"),
                "xml" => Some("xml"),

                // 压缩文件
                "zip" => Some("zip"),
                "rar" => Some("rar"),
                "7z" => Some("7z"),
                "tar" => Some("tar"),
                "gz" => Some("gz"),

                // 代码文件
                "js" => Some("js"),
                "ts" => Some("ts"),
                "jsx" => Some("jsx"),
                "tsx" => Some("tsx"),
                "py" => Some("py"),
                "java" => Some("java"),
                "cpp" => Some("cpp"),
                "c" => Some("c"),
                "go" => Some("go"),
                "rs" => Some("rs"),
                "html" => Some("html"),
                "css" => Some("css"),

                _ => None,
            }
        })
        .unwrap_or("bin"); // 未知类型使用 .bin

    format!("{:x}.{}", result, extension)
}

/// 下载图片并缓存
async fn download_and_cache(
    _app: &AppHandle,
    url: &str,
    cache_path: &PathBuf,
) -> Result<(), String> {
    info!("📥 开始下载图片: {}", url);

    let response = reqwest::get(url)
        .await
        .map_err(|e| format!("下载图片失败: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("下载失败，HTTP 状态码: {}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("读取图片数据失败: {}", e))?;

    fs::write(cache_path, bytes).map_err(|e| format!("保存图片到缓存失败: {}", e))?;

    info!("✅ 图片已缓存到: {:?}", cache_path);

    Ok(())
}

/// Tauri 命令：获取文件缓存路径（通用版本，支持所有文件类型）
///
/// 如果文件已缓存，返回本地文件路径（convertFileSrc 格式）
/// 如果未缓存，下载并缓存后返回本地文件路径
/// 如果下载失败，返回原始 URL
#[tauri::command]
pub async fn get_cached_file_path(app: AppHandle, url: String) -> Result<String, String> {
    // 如果不是 HTTP/HTTPS URL，直接返回（可能是本地文件）
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Ok(url);
    }

    let cache_dir = get_cache_dir(&app)?;
    let filename = get_cache_filename(&url);
    let cache_path = cache_dir.join(&filename);

    // 检查缓存是否存在
    if cache_path.exists() {
        info!("✅ 使用缓存的文件: {:?}", cache_path);
        // 返回文件系统路径（前端会使用 convertFileSrc 转换）
        return cache_path
            .to_str()
            .map(|s| s.to_string())
            .ok_or_else(|| "路径转换失败".to_string());
    }

    // 下载并缓存
    match download_and_cache(&app, &url, &cache_path).await {
        Ok(_) => cache_path
            .to_str()
            .map(|s| s.to_string())
            .ok_or_else(|| "路径转换失败".to_string()),
        Err(e) => {
            warn!("⚠️ 下载失败，使用原始 URL: {}", e);
            // 下载失败时返回原始 URL
            Ok(url)
        }
    }
}

/// Tauri 命令：获取图片缓存路径（保留向后兼容）
#[tauri::command]
pub async fn get_cached_image_path(app: AppHandle, url: String) -> Result<String, String> {
    get_cached_file_path(app, url).await
}

/// Tauri 命令：清除所有图片缓存
#[tauri::command]
pub async fn clear_image_cache(app: AppHandle) -> Result<(), String> {
    let cache_dir = get_cache_dir(&app)?;

    if cache_dir.exists() {
        fs::remove_dir_all(&cache_dir).map_err(|e| format!("清除缓存失败: {}", e))?;

        // 重新创建缓存目录
        fs::create_dir_all(&cache_dir).map_err(|e| format!("创建缓存目录失败: {}", e))?;

        info!("✅ 图片缓存已清除");
    }

    Ok(())
}

/// Tauri 命令：获取缓存大小（字节）
#[tauri::command]
pub async fn get_cache_size(app: AppHandle) -> Result<u64, String> {
    let cache_dir = get_cache_dir(&app)?;

    if !cache_dir.exists() {
        return Ok(0);
    }

    let mut total_size = 0u64;

    if let Ok(entries) = fs::read_dir(&cache_dir) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    total_size += metadata.len();
                }
            }
        }
    }

    Ok(total_size)
}

/// Tauri 命令：保存文件到指定路径
#[tauri::command]
pub async fn save_file_to_path(file_path: String, data: Vec<u8>) -> Result<(), String> {
    info!("💾 保存文件到: {}", file_path);

    let mut file = fs::File::create(&file_path).map_err(|e| format!("创建文件失败: {}", e))?;

    file.write_all(&data)
        .map_err(|e| format!("写入文件失败: {}", e))?;

    info!("✅ 文件已保存: {}", file_path);

    Ok(())
}

/// Tauri 命令：读取文件字节数据
#[tauri::command]
pub async fn read_file_bytes(file_path: String) -> Result<Vec<u8>, String> {
    info!("📖 读取文件: {}", file_path);

    let data = fs::read(&file_path).map_err(|e| format!("读取文件失败: {}", e))?;

    info!("✅ 文件已读取: {} 字节", data.len());

    Ok(data)
}
