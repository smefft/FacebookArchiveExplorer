use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};

#[derive(Debug, Serialize, Deserialize)]
pub struct UncategorizedFriendsFile {
    pub friends_v2: Option<Vec<Friend>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Friend {
    pub name: Option<String>,
    pub timestamp: Option<i64>,
}

#[tauri::command]
pub fn get_friends_from_path(base_path: String) -> Result<Vec<Friend>, String> {
    let root_path = PathBuf::from(&base_path);
    let file_path = root_path.join("connections/friends/your_friends.json");

    if !file_path.exists() {
        return Err("Could not find the 'connections/friends/your_friends.json' file".to_string());
    }

    let file_content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read your_friends.json: {}", e))?;

    let friends_file: UncategorizedFriendsFile = serde_json::from_str(&file_content)
        .map_err(|e| format!("Failed to parse your_friends.json: {}", e))?;

    let friends: Vec<Friend> = friends_file.friends_v2.unwrap_or_default();

    Ok(friends)
}
