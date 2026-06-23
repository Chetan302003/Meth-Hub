#[cfg_attr(mobile, tauri::mobile_entry_point)]
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::LazyLock; // Standard library alternative to once_cell
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

mod telemetry;
mod rpc;

// This prevents the app from spamming the game while it's trying to close
static GAME_CLOSING: LazyLock<AtomicBool> = LazyLock::new(|| AtomicBool::new(false));


#[tauri::command]
fn reset_telemetry_lock() {
    GAME_CLOSING.store(false, Ordering::Relaxed);
}

#[tauri::command]
fn open_devtools(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        window.open_devtools();
    }
}

#[tauri::command]
fn install_telemetry_plugin(app: AppHandle, custom_path: Option<String>) -> Result<String, String> {
    // Note: The dll must be bundled in `src-tauri/resources/meth_hub_telemetry.dll`
    let resource_path = app.path().resource_dir()
        .map_err(|e| format!("Failed to resolve resource directory: {}", e))?
        .join("scs-telemetry.dll");

    if !resource_path.exists() {
        return Err("Telemetry DLL not found in app resources. Contact developer.".to_string());
    }

    // Use custom path if provided, otherwise use default Steam path
    let game_root = match custom_path {
        Some(p) => PathBuf::from(p),
        None => PathBuf::from("C:\\Program Files (x86)\\Steam\\steamapps\\common\\Euro Truck Simulator 2"),
    };

    // Check if game exists
    if !game_root.exists() {
        return Err("GAME_NOT_FOUND".to_string());
    }

    let ets2_target = game_root.join("bin").join("win_x64").join("plugins");
    
    if !ets2_target.exists() {
        std::fs::create_dir_all(&ets2_target).map_err(|e| format!("Failed to create plugins folder: {}", e))?;
    }

    let final_dest = ets2_target.join("scs-telemetry.dll");
    
    // Copy the file
    match std::fs::copy(&resource_path, &final_dest) {
        Ok(_) => Ok("Telemetry SDK successfully installed to ETS2!".to_string()),
        Err(e) => Err(format!("Failed to copy DLL: {}", e))
    }
}

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
use tauri_plugin_aptabase::EventTracker;

#[allow(dead_code)]
struct TrayState(tauri::tray::TrayIcon);

pub fn run() {
    tauri::Builder::default()
        .manage(rpc::DiscordState(std::sync::Mutex::new(None)))
        // Initialize all plugins here at the top level
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_aptabase::Builder::new(env!("VITE_APTABASE_APP_KEY")).build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(
            tauri_plugin_log::Builder::default()
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir { file_name: None }),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
                ])
                .level(log::LevelFilter::Info)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            telemetry::get_telemetry_data, 
            reset_telemetry_lock,
            open_devtools,
            install_telemetry_plugin,
            rpc::init_discord_rpc,
            rpc::set_discord_rpc,
            rpc::clear_discord_rpc
        ])
        .setup(|app| {
            // Track an event immediately on startup to verify Rust connection
            let _ = app.track_event("rust_backend_started", None);

            #[cfg(debug_assertions)]
            {
                if let Some(_window) = app.get_webview_window("main") {
                    println!("DEBUG: 'main' window FOUND!");
                } else {
                    println!("DEBUG: 'main' window NOT FOUND!");
                    // print all windows
                    for (label, _w) in app.webview_windows() {
                        println!("DEBUG: found window with label: {}", label);
                    }
                }
            }

            // Create Tray Menu
            let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            // Build Tray Icon
            let tray = TrayIconBuilder::with_id("meth-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
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
                        }
                    }
                })
                .build(app)?;

            app.manage(TrayState(tray));

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Intercept close button
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
