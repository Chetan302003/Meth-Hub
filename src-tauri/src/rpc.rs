use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use std::sync::Mutex;

pub struct DiscordState {
    pub client: Mutex<Option<DiscordIpcClient>>,
    pub client_id: Mutex<Option<String>>,
}

impl DiscordState {
    pub fn new() -> Self {
        Self {
            client: Mutex::new(None),
            client_id: Mutex::new(None),
        }
    }
}

#[tauri::command]
pub fn init_discord_rpc(
    state: tauri::State<'_, DiscordState>,
    client_id: String,
) -> Result<(), String> {
    *state.client_id.lock().unwrap() = Some(client_id.clone());
    let mut client = DiscordIpcClient::new(&client_id);

    match client.connect() {
        Ok(_) => {
            *state.client.lock().unwrap() = Some(client);
            println!("Discord RPC: Connected successfully.");
            Ok(())
        }
        Err(e) => {
            *state.client.lock().unwrap() = None;
            println!("Discord RPC: Failed to connect initially: {:?}", e);
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
    let mut client_lock = state.client.lock().unwrap();

    // Auto-reconnect if socket was dropped or Discord restarted
    if client_lock.is_none() {
        if let Some(ref cid) = *state.client_id.lock().unwrap() {
            let mut new_client = DiscordIpcClient::new(cid);
            if new_client.connect().is_ok() {
                *client_lock = Some(new_client);
            }
        }
    }

    if let Some(client) = client_lock.as_mut() {
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

        match client.set_activity(payload.clone()) {
            Ok(_) => Ok(()),
            Err(e) => {
                // IPC socket broke (Discord reloaded/restarted or named pipe closed)
                *client_lock = None;

                // Try one immediate reconnect
                if let Some(ref cid) = *state.client_id.lock().unwrap() {
                    let mut new_client = DiscordIpcClient::new(cid);
                    if new_client.connect().is_ok() {
                        let res = new_client.set_activity(payload).map_err(|err| err.to_string());
                        *client_lock = Some(new_client);
                        return res;
                    }
                }
                Err(format!("Discord IPC connection dropped: {}", e))
            }
        }
    } else {
        Err("Discord RPC not running (Discord is not open)".to_string())
    }
}

#[tauri::command]
pub fn clear_discord_rpc(state: tauri::State<'_, DiscordState>) -> Result<(), String> {
    let mut client_lock = state.client.lock().unwrap();
    if let Some(client) = client_lock.as_mut() {
        let _ = client.clear_activity();
        Ok(())
    } else {
        Ok(())
    }
}
