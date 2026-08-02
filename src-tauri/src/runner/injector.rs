use enigo::{Button, Direction, Enigo, Key, Keyboard, Mouse, Settings};

/// Abstraction over the OS input injection so the runner loops can be unit
/// tested without sending real keys. Production uses [`EnigoInjector`]; tests
/// use a recording mock.
pub(crate) trait KeyInjector: Send {
    fn press(&mut self, key: Key);
    fn release(&mut self, key: Key);
    fn press_right_click(&mut self);
    fn release_right_click(&mut self);
}

/// Maps a step key string to an injectable enigo key.
///
/// Single characters inject as `Key::Unicode` (SendInput `KEYEVENTF_UNICODE`,
/// the proven path for letters/digits). Named tokens — the vocabulary emitted
/// by the recorder's `vk_to_readable`, plus common aliases — map to real VK
/// keys, so a recorded `Space`/`F1`/`PageUp` replays as itself instead of its
/// first letter. Unknown tokens return `None` and the step is skipped.
pub(crate) fn parse_key(raw: &str) -> Option<Key> {
    let s = raw.trim();
    let mut chars = s.chars();
    let first = chars.next()?;
    if chars.next().is_none() {
        return Some(Key::Unicode(first));
    }

    let upper = s.to_ascii_uppercase();
    match upper.as_str() {
        "SPACE" => Some(Key::Space),
        "ENTER" => Some(Key::Return),
        "ESCAPE" | "ESC" => Some(Key::Escape),
        "TAB" => Some(Key::Tab),
        "BACKSPACE" => Some(Key::Backspace),
        "DELETE" | "DEL" => Some(Key::Delete),
        "INSERT" => Some(Key::Insert),
        "HOME" => Some(Key::Home),
        "END" => Some(Key::End),
        "PAGEUP" | "PGUP" => Some(Key::PageUp),
        "PAGEDOWN" | "PGDN" => Some(Key::PageDown),
        "LEFT" => Some(Key::LeftArrow),
        "RIGHT" => Some(Key::RightArrow),
        "UP" => Some(Key::UpArrow),
        "DOWN" => Some(Key::DownArrow),
        _ => {
            if let Some(digits) = upper.strip_prefix('F') {
                if let Ok(n) = digits.parse::<u8>() {
                    if (1..=24).contains(&n) {
                        return Some(F_KEYS[(n - 1) as usize]);
                    }
                }
            }
            if let Some(digits) = upper.strip_prefix("NUM") {
                if let Ok(n) = digits.parse::<u8>() {
                    if n <= 9 {
                        return Some(NUM_KEYS[n as usize]);
                    }
                }
            }
            None
        }
    }
}

const F_KEYS: [Key; 24] = [
    Key::F1, Key::F2, Key::F3, Key::F4, Key::F5, Key::F6, Key::F7, Key::F8, Key::F9, Key::F10,
    Key::F11, Key::F12, Key::F13, Key::F14, Key::F15, Key::F16, Key::F17, Key::F18, Key::F19,
    Key::F20, Key::F21, Key::F22, Key::F23, Key::F24,
];

const NUM_KEYS: [Key; 10] = [
    Key::Num0, Key::Num1, Key::Num2, Key::Num3, Key::Num4, Key::Num5, Key::Num6, Key::Num7,
    Key::Num8, Key::Num9,
];

/// Releases every key it was constructed with when dropped. The runner loops
/// press/release through the guard, so a normal return, a Repeat-N finish, a
/// cancellation, and a panic (unwinding runs destructors) all release held
/// keys exactly once. Right-click is released first, then the step keys.
pub(crate) struct KeyReleaseGuard<'a> {
    injector: &'a mut dyn KeyInjector,
    keys: Vec<Key>,
    release_right_click: bool,
}

impl<'a> KeyReleaseGuard<'a> {
    pub(crate) fn new(
        injector: &'a mut dyn KeyInjector,
        keys: Vec<Key>,
        release_right_click: bool,
    ) -> Self {
        KeyReleaseGuard {
            injector,
            keys,
            release_right_click,
        }
    }

    pub(crate) fn press(&mut self, key: Key) {
        self.injector.press(key);
    }

    pub(crate) fn release(&mut self, key: Key) {
        self.injector.release(key);
    }

    pub(crate) fn press_right_click(&mut self) {
        self.injector.press_right_click();
    }
}

impl Drop for KeyReleaseGuard<'_> {
    fn drop(&mut self) {
        if self.release_right_click {
            self.injector.release_right_click();
        }
        for key in &self.keys {
            self.injector.release(*key);
        }
    }
}

/// Real injection via enigo (Win32 `SendInput` on Windows). If enigo can't be
/// created, injection is silently skipped — same behavior as the original code.
pub(crate) struct EnigoInjector(Option<Enigo>);

impl EnigoInjector {
    pub(crate) fn new() -> Self {
        EnigoInjector(Enigo::new(&Settings::default()).ok())
    }
}

impl KeyInjector for EnigoInjector {
    fn press(&mut self, key: Key) {
        if let Some(enigo) = self.0.as_mut() {
            let _ = enigo.key(key, Direction::Press);
        }
    }

    fn release(&mut self, key: Key) {
        if let Some(enigo) = self.0.as_mut() {
            let _ = enigo.key(key, Direction::Release);
        }
    }

    fn press_right_click(&mut self) {
        if let Some(enigo) = self.0.as_mut() {
            let _ = enigo.button(Button::Right, Direction::Press);
        }
    }

    fn release_right_click(&mut self) {
        if let Some(enigo) = self.0.as_mut() {
            let _ = enigo.button(Button::Right, Direction::Release);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_key_single_chars_are_unicode() {
        assert_eq!(parse_key("q"), Some(Key::Unicode('q')));
        assert_eq!(parse_key("5"), Some(Key::Unicode('5')));
        assert_eq!(parse_key(";"), Some(Key::Unicode(';')));
        assert_eq!(parse_key(""), None);
        assert_eq!(parse_key("   "), None);
    }

    #[test]
    fn parse_key_maps_recorder_tokens_to_vk_keys() {
        assert_eq!(parse_key("Space"), Some(Key::Space));
        assert_eq!(parse_key("Enter"), Some(Key::Return));
        assert_eq!(parse_key("Escape"), Some(Key::Escape));
        assert_eq!(parse_key("Tab"), Some(Key::Tab));
        assert_eq!(parse_key("Backspace"), Some(Key::Backspace));
        assert_eq!(parse_key("Delete"), Some(Key::Delete));
        assert_eq!(parse_key("Insert"), Some(Key::Insert));
        assert_eq!(parse_key("Home"), Some(Key::Home));
        assert_eq!(parse_key("End"), Some(Key::End));
        assert_eq!(parse_key("PageUp"), Some(Key::PageUp));
        assert_eq!(parse_key("PageDown"), Some(Key::PageDown));
        assert_eq!(parse_key("Left"), Some(Key::LeftArrow));
        assert_eq!(parse_key("Right"), Some(Key::RightArrow));
        assert_eq!(parse_key("Up"), Some(Key::UpArrow));
        assert_eq!(parse_key("Down"), Some(Key::DownArrow));
        assert_eq!(parse_key("F1"), Some(Key::F1));
        assert_eq!(parse_key("F12"), Some(Key::F12));
        assert_eq!(parse_key("F24"), Some(Key::F24));
        assert_eq!(parse_key("Num0"), Some(Key::Num0));
        assert_eq!(parse_key("Num9"), Some(Key::Num9));
    }

    #[test]
    fn parse_key_is_case_insensitive_for_tokens() {
        assert_eq!(parse_key("space"), Some(Key::Space));
        assert_eq!(parse_key("ENTER"), Some(Key::Return));
        assert_eq!(parse_key("f5"), Some(Key::F5));
        assert_eq!(parse_key("num3"), Some(Key::Num3));
        assert_eq!(parse_key("pagedown"), Some(Key::PageDown));
    }

    #[test]
    fn parse_key_rejects_unknown_tokens() {
        assert_eq!(parse_key("VK_999"), None);
        assert_eq!(parse_key("XYZ"), None);
        assert_eq!(parse_key("F0"), None);
        assert_eq!(parse_key("F25"), None);
        assert_eq!(parse_key("Num10"), None);
        assert_eq!(parse_key("Shift"), None, "modifiers are intentionally unsupported");
    }
}

#[cfg(test)]
pub(crate) mod test_utils {
    use std::sync::Arc;

    use super::KeyInjector;
    use enigo::Key;
    use parking_lot::Mutex;

    #[derive(Debug, Clone, PartialEq, Eq)]
    pub(crate) enum InjectedEvent {
        Press(Key),
        Release(Key),
        PressRightClick,
        ReleaseRightClick,
    }

    /// Records every injected action into a shared log so tests can assert on
    /// the exact event sequence. Clone the shared `Arc` into a factory to use
    /// it across multiple spawned channels.
    #[derive(Default)]
    pub(crate) struct MockInjector {
        events: Arc<Mutex<Vec<InjectedEvent>>>,
    }

    impl MockInjector {
        pub(crate) fn new_shared() -> (Self, Arc<Mutex<Vec<InjectedEvent>>>) {
            let log = Arc::new(Mutex::new(Vec::new()));
            (MockInjector { events: log.clone() }, log)
        }

        /// Builds an injector that appends to a shared log — used by factories
        /// so multiple spawned channels can be asserted on as one sequence.
        pub(crate) fn with_log(log: Arc<Mutex<Vec<InjectedEvent>>>) -> Self {
            MockInjector { events: log }
        }

        pub(crate) fn log(&self) -> Arc<Mutex<Vec<InjectedEvent>>> {
            self.events.clone()
        }
    }

    impl KeyInjector for MockInjector {
        fn press(&mut self, key: Key) {
            self.events.lock().push(InjectedEvent::Press(key));
        }

        fn release(&mut self, key: Key) {
            self.events.lock().push(InjectedEvent::Release(key));
        }

        fn press_right_click(&mut self) {
            self.events.lock().push(InjectedEvent::PressRightClick);
        }

        fn release_right_click(&mut self) {
            self.events.lock().push(InjectedEvent::ReleaseRightClick);
        }
    }
}
