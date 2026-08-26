use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
};

use chrono::{DateTime, Datelike};

use crate::helpers::fix_fb_text;

use serde::{Deserialize, Serialize};

// Structs
#[derive(Debug, Serialize, Deserialize)]
pub struct Photo {
    pub uri: Option<String>,
    pub title: Option<String>,
    pub description: Option<String>,
    pub creation_timestamp: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UncategorizedPhotosFile {
    pub other_photos_v2: Option<Vec<Photo>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RawAlbum {
    pub name: Option<String>,
    pub description: Option<String>,
    pub last_modified_timestamp: Option<i64>,
    pub cover_photo: Option<Photo>,
    pub photos: Option<Vec<Photo>>,
}

#[derive(Debug, Serialize)]
pub struct CleanAlbum {
    pub id: String,
    pub name: String,
    pub description: String,
    pub photo_count: usize,
    pub cover_photo: Option<CleanPhoto>,
    pub photos: Vec<CleanPhoto>,
}

#[derive(Debug, Serialize, Clone)]
pub struct CleanPhoto {
    pub title: String,
    pub description: String,
    pub timestamp: Option<i64>,
    pub image_url: String,
    pub source_path: String,
}

// functions
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

fn get_uncategorized_photos(root_path: PathBuf) -> Result<Vec<CleanPhoto>, String> {
    let uncategorized_photos_file =
        root_path.join("your_facebook_activity/posts/your_uncategorized_photos.json");
    if !uncategorized_photos_file.exists() {
        return Err(
            "Could not find the 'your_facebook_activity/posts/your_uncategorized_photos.json' file"
                .to_string(),
        );
    }
    let file_content = fs::read_to_string(&uncategorized_photos_file)
        .map_err(|e| format!("Failed to read your_uncategorized_photos.json: {}", e))?;

    let data: UncategorizedPhotosFile = serde_json::from_str(&file_content)
        .map_err(|e| format!("Failed to parse your_uncategorized_photos.json: {}", e))?;

    let photos = data
        .other_photos_v2
        .unwrap_or_default()
        .iter()
        .filter_map(|p| clean_photo(p, &root_path))
        .collect();

    Ok(photos)
}

fn load_all_raw_albums(albums_dir: &Path) -> Vec<(String, RawAlbum)> {
    let mut raw_albums = Vec::new();

    if let Ok(entries) = fs::read_dir(albums_dir) {
        for entry in entries.flatten() {
            if entry.path().extension().and_then(|s| s.to_str()) != Some("json") {
                continue;
            }

            let Ok(file_content) = fs::read_to_string(entry.path()) else {
                continue;
            };

            let Ok(raw_album) = serde_json::from_str::<RawAlbum>(&file_content) else {
                continue;
            };

            let id = entry.file_name().to_string_lossy().to_string();
            raw_albums.push((id, raw_album));
        }
    }

    raw_albums
}

// external commands

#[tauri::command]
pub fn get_profile_pictures_album(base_path: String) -> Result<CleanAlbum, String> {
    let root_path = PathBuf::from(&base_path);
    let albums_dir = root_path.join("your_facebook_activity/posts/album");
    if !albums_dir.exists() {
        return Err(format!(
            "Could not find the 'your_facebook_activity/posts/album' folder inside '{}'",
            base_path
        ));
    }

    let mut album: Option<CleanAlbum> = None;

    for (id, raw_album) in load_all_raw_albums(&albums_dir) {
        if raw_album.name.as_deref() == Some("Profile pictures") {
            let cleaned_photos: Vec<CleanPhoto> = raw_album
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
                album = Some(CleanAlbum {
                    id,
                    name: fix_fb_text(raw_album.name),
                    description: fix_fb_text(raw_album.description),
                    photo_count: cleaned_photos.len(),
                    cover_photo,
                    photos: cleaned_photos,
                });
            }

            break; // found it, no need to keep scanning
        }
    }

    album.ok_or_else(|| "Could not find a 'Profile pictures' album with photos".to_string())
}

#[tauri::command]
pub fn get_cover_photo_album(base_path: String) -> Result<CleanAlbum, String> {
    let root_path = PathBuf::from(&base_path);
    let albums_dir = root_path.join("your_facebook_activity/posts/album");
    if !albums_dir.exists() {
        return Err(format!(
            "Could not find the 'your_facebook_activity/posts/album' folder inside '{}'",
            base_path
        ));
    }

    let mut album: Option<CleanAlbum> = None;

    for (id, raw_album) in load_all_raw_albums(&albums_dir) {
        if raw_album.name.as_deref() == Some("Cover photos") {
            let cleaned_photos: Vec<CleanPhoto> = raw_album
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
                album = Some(CleanAlbum {
                    id,
                    name: fix_fb_text(raw_album.name),
                    description: fix_fb_text(raw_album.description),
                    photo_count: cleaned_photos.len(),
                    cover_photo,
                    photos: cleaned_photos,
                });
            }

            break; // found it, no need to keep scanning
        }
    }

    album.ok_or_else(|| "Could not find a 'Cover photos' album with photos".to_string())
}

#[tauri::command]
pub fn get_albums_from_path(base_path: String) -> Result<Vec<CleanAlbum>, String> {
    let root_path = PathBuf::from(&base_path);
    let albums_dir = root_path.join("your_facebook_activity/posts/album");

    if !albums_dir.exists() {
        return Err(format!(
            "Could not find the 'your_facebook_activity/posts/album' folder inside '{}'",
            base_path
        ));
    }

    let mut albums = Vec::new();

    for (id, raw_album) in load_all_raw_albums(&albums_dir) {
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
                id,
                name: fix_fb_text(raw_album.name),
                description: fix_fb_text(raw_album.description),
                photo_count: cleaned_photos.len(),
                cover_photo,
                photos: cleaned_photos,
            });
        }
    }

    let uncategorized_photos = get_uncategorized_photos(root_path);

    match uncategorized_photos {
        Ok(photos) if !photos.is_empty() => {
            albums.push(CleanAlbum {
                id: "Uncategorized Photos".to_string(),
                name: "Uncategorized Photos".to_string(),
                description: "Uncategorized Photos".to_string(),
                photo_count: photos.len(),
                cover_photo: Some(photos[0].clone()),
                photos,
            });
        }
        Ok(_) => {
            // Either None (file didn't exist) or an empty Vec — nothing to add
        }
        Err(e) => return Err(e),
    }

    Ok(albums)
}

#[tauri::command]
pub fn get_photos_by_year(base_path: String) -> Result<Vec<CleanAlbum>, String> {
    let root_path = PathBuf::from(&base_path);
    let albums_dir = root_path.join("your_facebook_activity/posts/album");

    if !albums_dir.exists() {
        return Err(format!(
            "Could not find the 'your_facebook_activity/posts/album' folder inside '{}'",
            base_path
        ));
    }

    let mut all_photos: Vec<CleanPhoto> = Vec::new();

    for (_id, raw_album) in load_all_raw_albums(&albums_dir) {
        let cleaned_photos: Vec<CleanPhoto> = raw_album
            .photos
            .unwrap_or_default()
            .iter()
            .filter_map(|p| clean_photo(p, &root_path))
            .collect();

        all_photos.extend(cleaned_photos);
    }

    all_photos.extend(get_uncategorized_photos(root_path)?);

    Ok(group_photos_by_year(all_photos))
}

pub fn group_photos_by_year(photos: Vec<CleanPhoto>) -> Vec<CleanAlbum> {
    let mut by_year: HashMap<i32, Vec<CleanPhoto>> = HashMap::new();

    for photo in photos {
        let year = photo
            .timestamp
            .and_then(|ts| DateTime::from_timestamp(ts, 0))
            .map(|dt| dt.year())
            .unwrap_or(0); // bucket for photos with no/invalid timestamp

        by_year.entry(year).or_default().push(photo);
    }

    let mut albums: Vec<CleanAlbum> = by_year
        .into_iter()
        .map(|(year, mut photos)| {
            photos.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

            let cover_photo = photos.first().cloned();

            CleanAlbum {
                id: year.to_string(),
                name: if year == 0 {
                    "Unknown Date".to_string()
                } else {
                    year.to_string()
                },
                description: String::new(),
                photo_count: photos.len(),
                cover_photo,
                photos,
            }
        })
        .collect();

    albums.sort_by(|a, b| b.id.cmp(&a.id));

    albums
}

#[tauri::command]
pub fn save_photo_locally(
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
pub fn delete_album_locally(
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
