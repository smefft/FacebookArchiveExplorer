#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod friends;
mod helpers;
mod messages;
mod photos;
mod videos;

use friends::get_friends_from_path;
use photos::{
    delete_album_locally, get_albums_from_path, get_cover_photo_album, get_photos_by_year,
    get_profile_pictures_album, save_photo_locally,
};
use tauri::{Manager, PhysicalPosition, PhysicalSize};
use videos::{get_videos_from_path, save_video_locally};

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let percent_screen = 0.95;
            let window = app.get_webview_window("main").unwrap();

            if let Some(monitor) = window.current_monitor()? {
                let screen_size = monitor.size();
                let screen_pos = monitor.position();

                let width = (screen_size.width as f64 * percent_screen) as u32;
                let height = (screen_size.height as f64 * percent_screen) as u32;

                window.set_size(PhysicalSize::new(width, height))?;
                let x = screen_pos.x + ((screen_size.width - width) / 2) as i32;
                let y = screen_pos.y + ((screen_size.height - height) / 2) as i32;

                window.set_position(PhysicalPosition::new(x, y))?;
            }

            Ok(())
        })
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            get_albums_from_path,
            get_videos_from_path,
            get_photos_by_year,
            save_photo_locally,
            save_video_locally,
            delete_album_locally,
            get_profile_pictures_album,
            get_cover_photo_album,
            get_friends_from_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
