use std::fs;
use std::path::{Path, PathBuf};

use std::process::Command;

use serde::{Deserialize, Serialize};

// structs
#[derive(Debug, Serialize, Deserialize)]
pub struct Video {
    pub uri: Option<String>,
    pub description: Option<String>,
    pub creation_timestamp: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VideosFile {
    pub videos_v2: Option<Vec<Video>>,
}

#[derive(Debug, Serialize, Clone)]
pub struct CleanVideo {
    pub video_url: String,
    pub description: String,
    pub timestamp: Option<i64>,
    pub thumbnail_url: Option<String>,
}

// helper functions
fn clean_video(v: &Video, base_path: &Path, thumbnails_path: &Path) -> Option<CleanVideo> {
    let uri = v.uri.as_ref()?;
    let absolute_path = base_path.join(&uri);
    let path_str = absolute_path.to_string_lossy().replace('\\', "/");

    let thumbnail_url =
        get_or_create_thumbnail(&absolute_path, thumbnails_path).map(|thumb_path| {
            let thumb_str = thumb_path.to_string_lossy().replace('\\', "/");
            format!("asset://localhost/{}", thumb_str)
        });

    Some(CleanVideo {
        video_url: format!("asset://localhost/{}", path_str),
        thumbnail_url,
        description: crate::helpers::fix_fb_text(v.description.clone()),
        timestamp: v.creation_timestamp,
    })
}

fn get_or_create_thumbnail(video_path: &Path, cache_dir: &Path) -> Option<PathBuf> {
    fs::create_dir_all(cache_dir).ok()?;

    let hash = format!(
        "{:x}",
        md5::compute(video_path.to_string_lossy().as_bytes())
    );
    let thumb_path = cache_dir.join(format!("{}.jpg", hash));

    if thumb_path.exists() {
        return Some(thumb_path);
    }

    let status = Command::new("ffmpeg")
        .args([
            "-i",
            &video_path.to_string_lossy(),
            "-ss",
            "00:00:01",
            "-vframes",
            "1",
            "-vf",
            "scale=320:-1",
            &thumb_path.to_string_lossy(),
        ])
        .output()
        .ok()?;

    if status.status.success() && thumb_path.exists() {
        Some(thumb_path)
    } else {
        None
    }
}

// external commands
#[tauri::command]
pub fn get_videos_from_path(base_path: String) -> Result<Vec<CleanVideo>, String> {
    let root_path = PathBuf::from(&base_path);
    let videos_file = root_path.join("your_facebook_activity/posts/your_videos.json");
    let thumbnails_dir = root_path.join("helpers/thumbnails");

    if !videos_file.exists() {
        return Err(format!(
            "Could not find 'your_facebook_activity/posts/your_videos.json' inside '{}'",
            base_path
        ));
    }

    let file_content = fs::read_to_string(&videos_file)
        .map_err(|e| format!("Failed to read your_videos.json: {}", e))?;

    let data: VideosFile = serde_json::from_str(&file_content)
        .map_err(|e| format!("Failed to parse your_videos.json: {}", e))?;

    let videos = data
        .videos_v2
        .unwrap_or_default()
        .iter()
        .filter_map(|v| clean_video(v, &root_path, &thumbnails_dir))
        .collect();
    Ok(videos)
}

#[tauri::command]
pub fn save_video_locally(
    source_path: String,
    dest_dir: String,
    filename: String,
    description: String,
    timestamp: Option<i64>,
) -> Result<(), String> {
    let dest_path = std::path::Path::new(&dest_dir);
    fs::create_dir_all(dest_path).map_err(|e| e.to_string())?;

    // Extract original extension (fallback to mp4)
    let ext = std::path::Path::new(&source_path)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("mp4");

    let target_video = dest_path.join(format!("{}.{}", filename, ext));

    // Instantly copy physical video file directly on disk
    fs::copy(&source_path, target_video).map_err(|e| format!("Failed copying video: {}", e))?;

    // Save sidecar .txt file if metadata exists
    if !description.is_empty() {
        let target_txt = dest_path.join(format!("{}.txt", filename));

        let date_str = match timestamp {
            Some(ts) => format!("{}", ts),
            None => "Unknown Date".to_string(),
        };

        let content = format!("Timestamp: {}\n\nDescription:\n{}", date_str, description);
        fs::write(target_txt, content).map_err(|e| format!("Failed writing text: {}", e))?;
    }

    Ok(())
}
