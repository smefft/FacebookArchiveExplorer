/*
Copyright (C) 2026 Sandra Effert

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>
*/

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
