mod focus;
mod injector;
mod potions;
mod processes;
mod skills;
mod timing;

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::thread::JoinHandle;

use parking_lot::Mutex;
use serde::Serialize;
use tauri::{AppHandle, Runtime, State};

use focus::spawn_focus_monitor;
pub use focus::AutoStopConfig;
use injector::{EnigoInjector, KeyInjector};
use potions::{spawn_potions, PotionConfig};
pub(crate) use processes::{dedupe_for_picker, running_processes_with_details, ProcessInfo};
use skills::{spawn_skills, SkillConfig};

pub use timing::init_timing;

/// Creates the key injector used by a spawned channel. Tests swap in a mock
/// factory so no real keys are ever sent.
pub(crate) type InjectorFactory = Arc<dyn Fn() -> Box<dyn KeyInjector> + Send + Sync>;

#[derive(Default)]
pub(crate) struct ChannelState {
    pub(crate) running: Arc<AtomicBool>,
    pub(crate) handle: Mutex<Option<JoinHandle<()>>>,
}

pub struct AppState {
    pub potions: ChannelState,
    pub skills: ChannelState,
    /// Serializes stop/start so a rapid combo switch can never interleave and
    /// leave one combo's potions running alongside another's skills.
    pub switch_lock: Mutex<()>,
    pub(crate) injector_factory: InjectorFactory,
    /// Bumped by every `start_combo`. A focus monitor captures the value at
    /// spawn and exits when it changes, so a monitor from a stopped combo can
    /// never stop the next one.
    pub(crate) monitor_gen: AtomicU64,
    /// Backend-issued identity of the current run. Zero means fully stopped.
    pub(crate) active_session: AtomicU64,
    session_gen: AtomicU64,
}

impl Default for AppState {
    fn default() -> Self {
        AppState {
            potions: ChannelState::default(),
            skills: ChannelState::default(),
            switch_lock: Mutex::new(()),
            injector_factory: Arc::new(|| Box::new(EnigoInjector::new())),
            monitor_gen: AtomicU64::new(0),
            active_session: AtomicU64::new(0),
            session_gen: AtomicU64::new(0),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunnerStatus {
    session_id: u64,
    potions_running: bool,
    skills_running: bool,
}

fn runner_status(state: &AppState) -> RunnerStatus {
    RunnerStatus {
        session_id: state.active_session.load(Ordering::SeqCst),
        potions_running: state.potions.running.load(Ordering::SeqCst),
        skills_running: state.skills.running.load(Ordering::SeqCst),
    }
}

pub(crate) fn stop_channel(state: &ChannelState) {
    state.running.store(false, Ordering::SeqCst);
    if let Some(handle) = state.handle.lock().take() {
        let _ = handle.join();
    }
}

/// Stops both channels without taking the lock — callers must hold
/// `switch_lock` (see `stop_all_inner` and the focus monitor).
pub(crate) fn stop_all_locked(potions: &ChannelState, skills: &ChannelState) {
    stop_channel(potions);
    stop_channel(skills);
}

/// Atomically stops both channels and starts whichever channels are provided.
/// A `None` channel is left stopped. Held under `switch_lock` so concurrent
/// switches are serialized.
#[tauri::command]
pub fn start_combo(
    auto_stop: Option<AutoStopConfig>,
    potions: Option<PotionConfig>,
    skills: Option<SkillConfig>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> RunnerStatus {
    start_combo_inner(auto_stop, potions, skills, &app, &state);
    runner_status(&state)
}

/// Testable core of `start_combo` — generic over the Tauri runtime so tests can
/// pass a mock `AppHandle`.
pub(crate) fn start_combo_inner<R: Runtime>(
    auto_stop: Option<AutoStopConfig>,
    potions: Option<PotionConfig>,
    skills: Option<SkillConfig>,
    app: &AppHandle<R>,
    state: &AppState,
) {
    let _guard = state.switch_lock.lock();

    stop_channel(&state.potions);
    stop_channel(&state.skills);

    let has_channels = potions.is_some() || skills.is_some();
    if has_channels {
        let session_id = state.session_gen.fetch_add(1, Ordering::SeqCst) + 1;
        state.active_session.store(session_id, Ordering::SeqCst);
    } else {
        state.active_session.store(0, Ordering::SeqCst);
    }

    if let Some(config) = potions {
        spawn_potions(config, app, state);
    }
    if let Some(config) = skills {
        let session_id = state.active_session.load(Ordering::SeqCst);
        spawn_skills(config, app, state, session_id);
    }

    // Invalidate any monitor from a previous combo, then guard this one.
    let gen = state.monitor_gen.fetch_add(1, Ordering::SeqCst) + 1;
    if let Some(config) = auto_stop.filter(|c| c.active()) {
        spawn_focus_monitor(config, gen, app);
    }
}

#[tauri::command]
pub fn stop_all(state: State<'_, AppState>) -> RunnerStatus {
    stop_all_inner(&state);
    runner_status(&state)
}

#[tauri::command]
pub fn get_runner_status(state: State<'_, AppState>) -> RunnerStatus {
    runner_status(&state)
}

/// Testable core of `stop_all`.
pub(crate) fn stop_all_inner(state: &AppState) {
    let _guard = state.switch_lock.lock();
    stop_all_locked(&state.potions, &state.skills);
    state.active_session.store(0, Ordering::SeqCst);
}

#[cfg(test)]
#[cfg(target_os = "windows")]
mod tests {
    use std::time::{Duration, Instant};

    use super::*;
    use crate::runner::injector::test_utils::{InjectedEvent, MockInjector};
    use enigo::Key;
    use potions::PotionConfig;
    use skills::{SkillConfig, SkillStep};
    use tauri::{Listener, Manager};

    const POTION_CHARS: [char; 4] = ['q', 'w', 'e', 'r'];

    fn build_app(state: AppState) -> tauri::App<tauri::test::MockRuntime> {
        tauri::test::mock_builder()
            .manage(state)
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap()
    }

    fn mock_app_with_factory(state: &mut AppState) -> Arc<Mutex<Vec<InjectedEvent>>> {
        let (mock, log) = MockInjector::new_shared();
        let shared = mock.log();
        state.injector_factory = Arc::new(move || Box::new(MockInjector::with_log(shared.clone())));
        log
    }

    fn skill_config(hold_right_click: bool, repeat_mode: &str, repeat_count: u64) -> SkillConfig {
        SkillConfig::for_test(
            vec![
                SkillStep::KeyDown { key: "b".into() },
                SkillStep::Delay { ms: 0 },
                SkillStep::KeyUp { key: "b".into() },
            ],
            hold_right_click,
            repeat_mode,
            repeat_count,
        )
    }

    /// Polls until both channel flags reach the expected state (spawned threads
    /// aren't joined by the caller, so we wait on the observable flag).
    fn wait_channel_idle(state: &AppState, potions_running: bool, skills_running: bool) {
        let start = Instant::now();
        loop {
            let p = state.potions.running.load(Ordering::SeqCst);
            let s = state.skills.running.load(Ordering::SeqCst);
            if p == potions_running && s == skills_running {
                return;
            }
            assert!(
                start.elapsed() < Duration::from_secs(5),
                "timed out waiting for potions={potions_running} skills={skills_running}"
            );
            std::thread::sleep(Duration::from_millis(5));
        }
    }

    #[test]
    fn start_combo_runs_only_enabled_channels() {
        let mut state = AppState::default();
        let log = mock_app_with_factory(&mut state);

        let app = build_app(state);
        let handle = app.handle().clone();

        // potions: single count with zero delay → runs and finishes quickly
        start_combo_inner(
            None,
            Some(PotionConfig::for_test(
                true, false, false, false, 0, "count", 1,
            )),
            None,
            &handle,
            &app.state::<AppState>(),
        );

        let state = app.state::<AppState>();
        wait_channel_idle(&state, false, false);

        let events = log.lock();
        assert!(
            events.contains(&InjectedEvent::Press(Key::Unicode('q'))),
            "potions channel should have injected"
        );
        assert!(
            !events.contains(&InjectedEvent::Press(Key::Unicode('w'))),
            "disabled key must not be injected"
        );
    }

    #[test]
    fn switching_combo_never_interleaves_channels() {
        let mut state = AppState::default();
        let log = mock_app_with_factory(&mut state);

        let app = build_app(state);
        let handle = app.handle().clone();

        // Start an infinite potions loop (long delay → stays alive while we switch).
        start_combo_inner(
            None,
            Some(PotionConfig::for_test(
                true, true, true, true, 100, "loop", 1,
            )),
            None,
            &handle,
            &app.state::<AppState>(),
        );

        // Wait until the potions loop has injected at least one press.
        let start = Instant::now();
        loop {
            if log
                .lock()
                .iter()
                .any(|e| matches!(e, InjectedEvent::Press(_)))
            {
                break;
            }
            assert!(
                start.elapsed() < Duration::from_secs(5),
                "potions loop never started"
            );
            std::thread::sleep(Duration::from_millis(5));
        }

        // Switch to skills (count 1 → finishes). Must stop potions first.
        start_combo_inner(
            None,
            None,
            Some(skill_config(true, "count", 1)),
            &handle,
            &app.state::<AppState>(),
        );

        let state = app.state::<AppState>();
        wait_channel_idle(&state, false, false);

        let events = log.lock().clone();
        let first_skill = events
            .iter()
            .position(|e| matches!(e, InjectedEvent::PressRightClick))
            .expect("skills channel should press right-click");

        // Nothing from the skills channel before the switch…
        assert!(
            events[..first_skill].iter().all(|e| !matches!(
                e,
                InjectedEvent::Press(Key::Unicode('b')) | InjectedEvent::Release(Key::Unicode('b'))
            )),
            "skills events must not appear before potions is stopped"
        );
        // …and nothing from the potions channel after it.
        assert!(
            events[first_skill..].iter().all(|e| !matches!(
                e,
                InjectedEvent::Press(Key::Unicode(c)) | InjectedEvent::Release(Key::Unicode(c))
                    if POTION_CHARS.contains(&c)
            )),
            "potions events must not continue after the switch"
        );
    }

    #[test]
    fn start_combo_with_no_channels_is_a_noop() {
        let app = build_app(AppState::default());
        let handle = app.handle().clone();

        start_combo_inner(None, None, None, &handle, &app.state::<AppState>());

        let state = app.state::<AppState>();
        assert!(!state.potions.running.load(Ordering::SeqCst));
        assert!(!state.skills.running.load(Ordering::SeqCst));
    }

    #[test]
    fn stop_all_stops_both_channels() {
        let mut state = AppState::default();
        let _log = mock_app_with_factory(&mut state);

        let app = build_app(state);
        let handle = app.handle().clone();

        start_combo_inner(
            None,
            Some(PotionConfig::for_test(
                true, true, true, true, 100, "loop", 1,
            )),
            Some(skill_config(false, "loop", 1)),
            &handle,
            &app.state::<AppState>(),
        );

        let state = app.state::<AppState>();
        assert!(state.potions.running.load(Ordering::SeqCst));
        assert!(state.skills.running.load(Ordering::SeqCst));

        stop_all_inner(&app.state::<AppState>());

        let state = app.state::<AppState>();
        assert!(!state.potions.running.load(Ordering::SeqCst));
        assert!(!state.skills.running.load(Ordering::SeqCst));
        // The join consumed both thread handles — no leaked threads.
        assert!(state.potions.handle.lock().is_none());
        assert!(state.skills.handle.lock().is_none());
    }

    #[test]
    fn stop_all_is_idempotent() {
        let mut state = AppState::default();
        let _log = mock_app_with_factory(&mut state);

        let app = build_app(state);
        let handle = app.handle().clone();

        start_combo_inner(
            None,
            Some(PotionConfig::for_test(
                true, true, true, true, 100, "loop", 1,
            )),
            Some(skill_config(false, "loop", 1)),
            &handle,
            &app.state::<AppState>(),
        );

        stop_all_inner(&app.state::<AppState>());
        stop_all_inner(&app.state::<AppState>());

        let state = app.state::<AppState>();
        assert!(!state.potions.running.load(Ordering::SeqCst));
        assert!(!state.skills.running.load(Ordering::SeqCst));
        assert!(state.potions.handle.lock().is_none());
        assert!(state.skills.handle.lock().is_none());
    }

    #[test]
    fn no_activation_events_after_stop() {
        use std::sync::atomic::AtomicUsize;

        let mut state = AppState::default();
        let _log = mock_app_with_factory(&mut state);

        let app = build_app(state);
        let handle = app.handle().clone();

        let count = Arc::new(AtomicUsize::new(0));
        let count_clone = count.clone();
        let _unlisten = handle.listen("macro-activation", move |_| {
            count_clone.fetch_add(1, Ordering::SeqCst);
        });

        // Zero delay → cycles run at full speed; the first activation (cycle 10)
        // arrives in microseconds.
        start_combo_inner(
            None,
            Some(PotionConfig::for_test(true, true, true, true, 0, "loop", 1)),
            None,
            &handle,
            &app.state::<AppState>(),
        );

        let start = Instant::now();
        while count.load(Ordering::SeqCst) == 0 {
            assert!(
                start.elapsed() < Duration::from_secs(5),
                "timed out waiting for the first activation"
            );
            std::thread::sleep(Duration::from_millis(5));
        }

        stop_all_inner(&app.state::<AppState>());

        // The channel thread is joined by stop — nothing can emit afterwards.
        let after_stop = count.load(Ordering::SeqCst);
        std::thread::sleep(Duration::from_millis(100));
        assert_eq!(
            count.load(Ordering::SeqCst),
            after_stop,
            "no activation events may be emitted after stop_all"
        );
    }
}
