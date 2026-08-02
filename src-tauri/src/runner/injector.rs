use enigo::{Button, Direction, Enigo, Key, Keyboard, Mouse, Settings};

/// Abstraction over the OS input injection so the runner loops can be unit
/// tested without sending real keys. Production uses [`EnigoInjector`]; tests
/// use a recording mock.
pub(crate) trait KeyInjector: Send {
    fn press(&mut self, key: char);
    fn release(&mut self, key: char);
    fn press_right_click(&mut self);
    fn release_right_click(&mut self);
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
    fn press(&mut self, key: char) {
        if let Some(enigo) = self.0.as_mut() {
            let _ = enigo.key(Key::Unicode(key), Direction::Press);
        }
    }

    fn release(&mut self, key: char) {
        if let Some(enigo) = self.0.as_mut() {
            let _ = enigo.key(Key::Unicode(key), Direction::Release);
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
pub(crate) mod test_utils {
    use std::sync::{Arc, Mutex};

    use super::KeyInjector;

    #[derive(Debug, Clone, PartialEq, Eq)]
    pub(crate) enum InjectedEvent {
        Press(char),
        Release(char),
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
        fn press(&mut self, key: char) {
            self.events.lock().unwrap().push(InjectedEvent::Press(key));
        }

        fn release(&mut self, key: char) {
            self.events.lock().unwrap().push(InjectedEvent::Release(key));
        }

        fn press_right_click(&mut self) {
            self.events.lock().unwrap().push(InjectedEvent::PressRightClick);
        }

        fn release_right_click(&mut self) {
            self.events.lock().unwrap().push(InjectedEvent::ReleaseRightClick);
        }
    }
}
