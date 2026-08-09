pub fn fix_fb_text(text: Option<String>) -> String {
    let text = text.unwrap_or_default();
    let bytes: Vec<u8> = text.chars().map(|c| c as u8).collect();
    String::from_utf8(bytes).unwrap_or(text)
}
