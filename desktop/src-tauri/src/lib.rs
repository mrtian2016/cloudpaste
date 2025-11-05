// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_log::{Target, TargetKind};

mod image_cache;
// 全局 API 配置
static GLOBAL_API_CONFIG: Lazy<Arc<Mutex<ApiConfig>>> = Lazy::new(|| {
    Arc::new(Mutex::new(ApiConfig {
        base_url: String::new(),
        token: String::new(),
        device_id: get_device_id(),
        device_name: get_device_name(),
        is_configured: false,
    }))
});

// API 配置（添加序列化支持）
#[derive(Debug, Clone, Serialize, Deserialize)]
struct ApiConfig {
    base_url: String,
    token: String,
    device_id: String,
    device_name: String,
    is_configured: bool,
}

impl ApiConfig {
    fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
        // 使用 Tauri 提供的跨平台 API 获取应用数据目录
        let app_data_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("获取应用数据目录失败: {}", e))?;

        // 确保目录存在
        std::fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("创建应用数据目录失败: {}", e))?;

        // 返回配置文件完整路径
        let mut config_path = app_data_dir;
        config_path.push("api_config.json");
        Ok(config_path)
    }

    fn load_from_disk(app: &AppHandle) -> Option<Self> {
        let path = Self::config_path(app).ok()?;
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(config) = serde_json::from_str::<Self>(&content) {
                    log::info!(
                        "✅ 从磁盘加载配置: base_url={}, is_configured={}",
                        config.base_url, config.is_configured
                    );
                    return Some(config);
                }
            }
        }
        None
    }

    fn save_to_disk(&self, app: &AppHandle) -> Result<(), String> {
        let path = Self::config_path(app)?;
        let content =
            serde_json::to_string_pretty(self).map_err(|e| format!("序列化失败: {}", e))?;

        fs::write(&path, content).map_err(|e| format!("写入文件失败: {}", e))?;

        log::info!("✅ 配置已保存到磁盘: {:?}", path);
        Ok(())
    }

    fn delete_from_disk(app: &AppHandle) -> Result<(), String> {
        let path = Self::config_path(app)?;
        if path.exists() {
            fs::remove_file(&path).map_err(|e| format!("删除文件失败: {}", e))?;
            log::info!("✅ 配置文件已删除: {:?}", path);
        }
        Ok(())
    }
}

// 获取设备唯一 ID（内部函数）
fn get_device_id() -> String {
    // 简单实现：使用机器名 + 时间戳
    // 实际应该保存到配置文件中
    format!(
        "desktop_{}",
        hostname::get()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string()
    )
}

// 获取设备名称（内部函数）
fn get_device_name() -> String {
    hostname::get()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string()
}

// Tauri 命令：获取设备 ID
#[tauri::command]
fn get_device_id_command() -> String {
    get_device_id()
}

// Tauri 命令：获取设备名称
#[tauri::command]
fn get_device_name_command() -> String {
    get_device_name()
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// 设置 API 配置
#[tauri::command]
fn set_api_config(app: AppHandle, api_url: String, token: String) -> Result<(), String> {
    log::info!(
        "🔧 set_api_config 被调用: api_url={}, token_len={}",
        api_url,
        token.len()
    );

    let mut config = GLOBAL_API_CONFIG
        .lock()
        .map_err(|e| format!("无法锁定配置: {}", e))?;

    // 移除 /api/v1 后缀（如果有）
    let base_url = api_url
        .trim_end_matches('/')
        .trim_end_matches("/api/v1")
        .to_string();

    config.base_url = format!("{}/api/v1", base_url);
    config.token = token;
    config.is_configured = true;

    log::info!(
        "✅ API 配置已更新: base_url={}, device_id={}, is_configured={}",
        config.base_url, config.device_id, config.is_configured
    );

    // 💾 持久化到磁盘
    config.save_to_disk(&app)?;

    log::info!("💾 配置已保存到磁盘");

    Ok(())
}

// 获取当前 API 配置状态
#[tauri::command]
fn get_api_config_status() -> Result<bool, String> {
    let config = GLOBAL_API_CONFIG
        .lock()
        .map_err(|e| format!("无法锁定配置: {}", e))?;

    Ok(config.is_configured)
}

// 清除 API 配置
#[tauri::command]
fn clear_api_config(app: AppHandle) -> Result<(), String> {
    let mut config = GLOBAL_API_CONFIG
        .lock()
        .map_err(|e| format!("无法锁定配置: {}", e))?;

    config.base_url = String::new();
    config.token = String::new();
    config.is_configured = false;

    log::info!("✅ API 配置已清除");

    // 🗑️ 从磁盘删除配置文件
    ApiConfig::delete_from_disk(&app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    log::info!("🚀 启动 Tauri 应用");
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir { file_name: None }),
                    Target::new(TargetKind::Webview),
                ])
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_single_instance::init(
            |_app_handle, _argv, _cwd| {
                log::info!("🚀 启动单实例应用");
            },
        ))
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--auto-launch"]),
        ))
        .plugin(tauri_plugin_clipboard_x::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_fs_pro::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_macos_permissions::init())
        .on_window_event(|window, event| match event {
            // 让 app 保持在后台运行：https://tauri.app/v1/guides/features/system-tray/#preventing-the-app-from-closing
            WindowEvent::CloseRequested { api, .. } => {
                window.hide().unwrap();

                api.prevent_close();
            }
            _ => {}
        })
        .setup(|app| {
            log::info!("=====================================");
            log::info!("平台: {}", std::env::consts::OS);
            log::info!("应用数据目录: {:?}", app.path().app_data_dir());
            log::info!("应用日志目录: {:?}", app.path().app_log_dir());
            log::info!("=====================================");
            // 创建托盘菜单项
            let show_item = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
            let hide_item = MenuItem::with_id(app, "hide", "隐藏窗口", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

            // 构建菜单
            let menu = Menu::with_items(app, &[&show_item, &hide_item, &quit_item])?;

            // 创建系统托盘图标
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.unminimize();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.unminimize();
                        }
                    }
                })
                .build(app)?;

            // 监听窗口关闭事件：点击关闭按钮时隐藏窗口而不是退出
            if let Some(window) = app.get_webview_window("main") {
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        let _ = window_clone.hide();
                        api.prevent_close();
                    }
                });
            }

            // 从磁盘加载配置（如果存在）
            if let Some(saved_config) = ApiConfig::load_from_disk(app.handle()) {
                if let Ok(mut config) = GLOBAL_API_CONFIG.lock() {
                    *config = saved_config;
                    log::info!("✅ 应用启动时已加载保存的配置");
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            set_api_config,
            get_api_config_status,
            clear_api_config,
            get_device_id_command,
            get_device_name_command,
            image_cache::get_cached_file_path,
            image_cache::get_cached_image_path,
            image_cache::clear_image_cache,
            image_cache::get_cache_size,
            image_cache::save_file_to_path,
            image_cache::read_file_bytes
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
