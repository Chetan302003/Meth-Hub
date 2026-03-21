use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use std::sync::Mutex;

pub struct DiscordState(pub Mutex<Option<DiscordIpcClient>>);

#[tauri::command]
pub fn init_discord_rpc(state: tauri::State<'_, DiscordState>, client_id: String) -> Result<(), String> {
    // In discord-rich-presence v1.1.0, new() returns the raw struct synchronously
    let mut client = DiscordIpcClient::new(&client_id);

    match client.connect() {
        Ok(_) => {
            *state.0.lock().unwrap() = Some(client);
            println!(" Titan Omega: Connected to Discord RPC successfully.");
            Ok(())
        }
        Err(e) => {
            println!(" Titan Omega: Failed to connect to Discord RPC: {:?}", e);
            Err(format!("Connect error: {:?}", e))
        }
    }
}

#[tauri::command]
pub fn set_discord_rpc(
    state: tauri::State<'_, DiscordState>,
    details: Option<String>,
    state_text: Option<String>,
    large_image_key: Option<String>,
    large_image_text: Option<String>,
    small_image_key: Option<String>,
    small_image_text: Option<String>,
) -> Result<(), String> {
    let mut lock = state.0.lock().unwrap();
    if let Some(client) = lock.as_mut() {
        let mut payload = activity::Activity::new();
        
        if let Some(ref d) = details {
            payload = payload.details(d);
        }
        if let Some(ref st) = state_text {
            payload = payload.state(st);
        }

        if large_image_key.is_some() || small_image_key.is_some() {
            let mut assets = activity::Assets::new();
            if let Some(ref lk) = large_image_key {
                assets = assets.large_image(lk);
            }
            if let Some(ref lt) = large_image_text {
                assets = assets.large_text(lt);
            }
            if let Some(ref sk) = small_image_key {
                assets = assets.small_image(sk);
            }
            if let Some(ref st) = small_image_text {
                assets = assets.small_text(st);
            }
            payload = payload.assets(assets);
        }

        client.set_activity(payload).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Discord RPC not initialized".to_string())
    }
}

#[tauri::command]
pub fn clear_discord_rpc(state: tauri::State<'_, DiscordState>) -> Result<(), String> {
    let mut lock = state.0.lock().unwrap();
    if let Some(client) = lock.as_mut() {
        client.clear_activity().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Discord RPC not initialized".to_string())
    }
}
