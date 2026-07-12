mod potions;
mod skills;
mod timing;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;

use tauri::State;

pub use potions::start_potions;
pub use skills::start_skills;
pub use timing::init_timing;

#[derive(Default)]
pub(crate) struct ChannelState {
    pub(crate) running: Arc<AtomicBool>,
    pub(crate) handle: Mutex<Option<JoinHandle<()>>>,
}

#[derive(Default)]
pub struct AppState {
    pub potions: ChannelState,
    pub skills: ChannelState,
}

pub(crate) fn stop_channel(state: &ChannelState) {
    state.running.store(false, Ordering::SeqCst);
    if let Some(handle) = state.handle.lock().unwrap().take() {
        let _ = handle.join();
    }
}

#[tauri::command]
pub fn stop_all(state: State<'_, AppState>) {
    stop_channel(&state.potions);
    stop_channel(&state.skills);
}
