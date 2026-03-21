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
fn install_telemetry_plugin(app: AppHandle, custom_path: Option<String>) -> Result<String, String> {
    // Note: The dll must be bundled in `src-tauri/resources/scs-telemetry.dll`
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

pub fn run() {
    tauri::Builder::default()
        .manage(rpc::DiscordState(std::sync::Mutex::new(None)))
        // Initialize all plugins here at the top level
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_log::Builder::default()
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir { file_name: None }),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
                ])
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            telemetry::get_telemetry_data, 
            reset_telemetry_lock,
            install_telemetry_plugin,
            rpc::init_discord_rpc,
            rpc::set_discord_rpc,
            rpc::clear_discord_rpc
        ])
    .setup(|_app|{
    Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
