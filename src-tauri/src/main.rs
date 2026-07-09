#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize)]
struct Photo {
    uri: Option<String>,
    title: Option<String>,
    description: Option<String>,
    creation_timestamp: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
struct RawAlbum {
    name: Option<String>,
    description: Option<String>,
    last_modified_timestamp: Option<i64>,
    cover_photo: Option<Photo>,
    photos: Option<Vec<Photo>>,
}

#[derive(Debug, Serialize)]
struct CleanAlbum {
    id: String,
    name: String,
    description: String,
    photo_count: usize,
    cover_photo: Option<CleanPhoto>,
    photos: Vec<CleanPhoto>,
}

#[derive(Debug, Serialize, Clone)]
struct CleanPhoto {
    title: String,
    description: String,
    timestamp: Option<i64>,
    image_url: String,
    source_path: String, // <-- NEW
}

fn fix_fb_text(text: Option<String>) -> String {
    let text = text.unwrap_or_default();
    let bytes: Vec<u8> = text.chars().map(|c| c as u8).collect();
    String::from_utf8(bytes).unwrap_or(text)
}

fn clean_photo(p: &Photo, base_path: &Path) -> Option<CleanPhoto> {
    let uri = p.uri.clone()?;

    let absolute_path = base_path.join(&uri);
    let path_str = absolute_path.to_string_lossy().replace('\\', "/");

    Some(CleanPhoto {
        title: fix_fb_text(p.title.clone()),
        description: fix_fb_text(p.description.clone()),
        timestamp: p.creation_timestamp,
        image_url: format!("asset://localhost/{}", path_str),
        source_path: absolute_path.to_string_lossy().to_string(), // <-- NEW
    })
}

#[tauri::command]
fn get_albums_from_path(base_path: String) -> Result<Vec<CleanAlbum>, String> {
    let root_path = PathBuf::from(&base_path);
    let albums_dir = root_path.join("your_facebook_activity/posts/album");

    if !albums_dir.exists() {
        return Err(format!(
            "Could not find the 'your_facebook_activity/posts/album' folder inside '{}'",
            base_path
        ));
    }

    let mut albums = Vec::new();

    if let Ok(entries) = fs::read_dir(albums_dir) {
        for entry in entries.flatten() {
            if entry.path().extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(file_content) = fs::read_to_string(entry.path()) {
                    if let Ok(raw_album) = serde_json::from_str::<RawAlbum>(&file_content) {
                        let mut cleaned_photos: Vec<CleanPhoto> = raw_album
                            .photos
                            .unwrap_or_default()
                            .iter()
                            .filter_map(|p| clean_photo(p, &root_path))
                            .collect();

                        let cover_photo = raw_album
                            .cover_photo
                            .as_ref()
                            .and_then(|p| clean_photo(p, &root_path))
                            .or_else(|| cleaned_photos.first().cloned());

                        if !cleaned_photos.is_empty() || cover_photo.is_some() {
                            albums.push(CleanAlbum {
                                id: entry.file_name().to_string_lossy().to_string(),
                                name: fix_fb_text(raw_album.name),
                                description: fix_fb_text(raw_album.description),
                                photo_count: cleaned_photos.len(),
                                cover_photo,
                                photos: cleaned_photos,
                            });
                        }
                    }
                }
            }
        }
    }

    Ok(albums)
}

#[tauri::command]
fn save_photo_locally(
    source_path: String,
    dest_dir: String,
    filename: String,
    title: String,
    description: String,
    timestamp: Option<i64>,
) -> Result<(), String> {
    let dest_path = std::path::Path::new(&dest_dir);
    fs::create_dir_all(dest_path).map_err(|e| e.to_string())?;

    // Extract original extension (fallback to jpg)
    let ext = std::path::Path::new(&source_path)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("jpg");

    let target_img = dest_path.join(format!("{}.{}", filename, ext));

    // Instantly copy physical image file directly on disk
    fs::copy(&source_path, target_img).map_err(|e| format!("Failed copying image: {}", e))?;

    // Save sidecar .txt file if metadata exists
    if !title.is_empty() || !description.is_empty() {
        let target_txt = dest_path.join(format!("{}.txt", filename));

        let date_str = match timestamp {
            Some(ts) => format!("{}", ts),
            None => "Unknown Date".to_string(),
        };

        let content = format!(
            "Title: {}\nTimestamp: {}\n\nDescription:\n{}",
            title, date_str, description
        );
        fs::write(target_txt, content).map_err(|e| format!("Failed writing text: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
fn delete_album_locally(
    album_id: String,
    base_path: String,
    photo_paths: Vec<String>,
) -> Result<(), String> {
    let root_path = std::path::PathBuf::from(&base_path);

    // 1. Delete the physical image files associated with the album
    for path_str in photo_paths {
        let img_path = std::path::Path::new(&path_str);
        if img_path.exists() {
            let _ = fs::remove_file(img_path); // Ignore individual errors if already gone
        }
    }

    // 2. Delete the album's JSON file so it won't appear on subsequent scans
    let json_path = root_path
        .join("your_facebook_activity/posts/album")
        .join(format!("{}.json", album_id));

    if json_path.exists() {
        fs::remove_file(json_path).map_err(|e| format!("Failed to delete album JSON: {}", e))?;
    }

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            get_albums_from_path,
            save_photo_locally,
            delete_album_locally
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
