#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod helpers;
mod messages;
mod photos;
mod videos;

use photos::{delete_album_locally, get_albums_from_path, get_photos_by_year, save_photo_locally};
use videos::{get_videos_from_path, save_video_locally};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            get_albums_from_path,
            get_videos_from_path,
            get_photos_by_year,
            save_photo_locally,
            save_video_locally,
            delete_album_locally
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
