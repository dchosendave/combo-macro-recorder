mod potions;
mod skills;
mod timing;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;

use tauri::{AppHandle, State};

use potions::{spawn_potions, PotionConfig};
use skills::{spawn_skills, SkillConfig};

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
    /// Serializes stop/start so a rapid combo switch can never interleave and
    /// leave one combo's potions running alongside another's skills.
    pub switch_lock: Mutex<()>,
}

pub(crate) fn stop_channel(state: &ChannelState) {
    state.running.store(false, Ordering::SeqCst);
    if let Some(handle) = state.handle.lock().unwrap().take() {
        let _ = handle.join();
    }
}

/// Atomically stops both channels and starts whichever channels are provided.
/// A `None` channel is left stopped. Held under `switch_lock` so concurrent
/// switches are serialized.
#[tauri::command]
pub fn start_combo(
    potions: Option<PotionConfig>,
    skills: Option<SkillConfig>,
    app: AppHandle,
    state: State<'_, AppState>,
) {
    let _guard = state.switch_lock.lock().unwrap();

    stop_channel(&state.potions);
    stop_channel(&state.skills);

    if let Some(config) = potions {
        spawn_potions(config, &app, &state);
    }
    if let Some(config) = skills {
        spawn_skills(config, &app, &state);
    }
}

#[tauri::command]
pub fn stop_all(state: State<'_, AppState>) {
    let _guard = state.switch_lock.lock().unwrap();
    stop_channel(&state.potions);
    stop_channel(&state.skills);
}
