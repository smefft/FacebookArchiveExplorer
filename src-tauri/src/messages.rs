use crate::photos::Photo;

pub struct Message {
    pub sender_name: String,
    pub timestamp_ms: Option<i64>,
    pub content: Option<String>,
    pub is_geoblocked_for_viewer: bool,
    pub photos: Vec<Photo>,
    pub is_unsent_image_by_messenger_kid_parent: bool,
}

pub struct MessageFile {
    pub messages: Option<Vec<Message>>,
    pub title: Option<String>,
    pub is_still_participant: Option<String>,
    pub thread_path: Option<String>,
}
