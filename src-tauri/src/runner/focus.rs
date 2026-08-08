use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

use serde::Deserialize;
use tauri::{AppHandle, Emitter, Manager, Runtime};

use super::processes::{process_name_matches, running_processes};
use super::{stop_all_inner, AppState};

/// How often the focus monitor samples the foreground window. Foreground
/// queries are cheap user32 calls; sub-second reaction is plenty for a macro
/// tool, and polling keeps the monitor free of window-event plumbing.
const POLL_INTERVAL: Duration = Duration::from_millis(250);
/// A foreground loss must persist this long before the combo is stopped.
/// Absorbs transient steals (dialogs, notifications) without killing a run.
const GRACE_PERIOD: Duration = Duration::from_millis(750);

/// Abstraction over foreground-window/process queries so the monitor's
/// decision logic is unit-testable without real OS calls. Production uses
/// [`WinForegroundProvider`]; tests use a scripted mock.
pub(crate) trait ForegroundProvider: Send + Sync {
    /// PID of the process owning the foreground window, or `None` when there
    /// is no foreground window (e.g. the desktop is showing).
    fn foreground_pid(&self) -> Option<u32>;
    /// Whether `pid` belongs to the process the user configured as the game.
    fn is_game_process(&self, pid: u32) -> bool;
}

/// Auto-stop-on-focus-loss config, carried by `start_combo`. `enabled` gates
/// the feature; `game_process` is the game's executable name (e.g.
/// `main.exe`), matched case-insensitively with an optional `.exe` suffix.
#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AutoStopConfig {
    pub enabled: bool,
    pub game_process: String,
}

impl AutoStopConfig {
    /// The feature only does anything when enabled AND a game process is set.
    pub fn active(&self) -> bool {
        self.enabled && !self.game_process.trim().is_empty()
    }
}

/// Timing knobs for the monitor loop; tests shrink them so grace-period
/// assertions run in milliseconds instead of seconds.
#[derive(Clone, Copy)]
pub(crate) struct MonitorTiming {
    pub poll_interval: Duration,
    pub grace: Duration,
}

impl Default for MonitorTiming {
    fn default() -> Self {
        Self {
            poll_interval: POLL_INTERVAL,
            grace: GRACE_PERIOD,
        }
    }
}

/// Spawns the focus monitor for a freshly started combo. The monitor is
/// self-terminating: it exits when the channels stop or when a newer combo
/// invalidates it via `monitor_gen`, so no handle needs to be stored.
pub(crate) fn spawn_focus_monitor<R: Runtime>(config: AutoStopConfig, gen: u64, app: &AppHandle<R>) {
    #[cfg(target_os = "windows")]
    let provider: Arc<dyn ForegroundProvider> =
        Arc::new(WinForegroundProvider::new(config.game_process.trim().to_string()));
    #[cfg(not(target_os = "windows"))]
    let provider: Arc<dyn ForegroundProvider> = Arc::new(NoopForegroundProvider);

    let _handle = spawn_focus_monitor_with(MonitorTiming::default(), provider, gen, app);
}

/// Testable core of the monitor. Polls the provider; once the game has been
/// observed focused at least once, a foreground loss persisting past the grace
/// period stops both channels and emits `macro-auto-stopped {reason:
/// "focus-lost"}`. Exits without acting if the channels are already stopped or
/// if `gen` no longer matches `state.monitor_gen` (a newer combo started).
pub(crate) fn spawn_focus_monitor_with<R: Runtime>(
    timing: MonitorTiming,
    provider: Arc<dyn ForegroundProvider>,
    gen: u64,
    app: &AppHandle<R>,
) -> thread::JoinHandle<()> {
    let app = app.clone();
    thread::spawn(move || {
        let mut game_seen = false;
        let mut lost_since: Option<Instant> = None;

        loop {
            let state = app.state::<AppState>();
            if !state.potions.running.load(Ordering::SeqCst)
                && !state.skills.running.load(Ordering::SeqCst)
            {
                return; // combo stopped normally — nothing left to guard
            }
            if state.monitor_gen.load(Ordering::SeqCst) != gen {
                return; // a newer combo superseded this monitor
            }

            match provider.foreground_pid() {
                Some(pid) if provider.is_game_process(pid) => {
                    game_seen = true;
                    lost_since = None;
                }
                Some(_) if game_seen => match lost_since {
                    None => lost_since = Some(Instant::now()),
                    Some(since) if since.elapsed() >= timing.grace => {
                        stop_all_inner(&state);
                        let _ = app.emit(
                            "macro-auto-stopped",
                            serde_json::json!({ "reason": "focus-lost" }),
                        );
                        return;
                    }
                    Some(_) => {}
                },
                // Game not yet seen, or no foreground window (desktop) — run on.
                _ => lost_since = None,
            }

            thread::sleep(timing.poll_interval);
        }
    })
}

#[cfg(target_os = "windows")]
pub(crate) struct WinForegroundProvider {
    game_process: String,
}

#[cfg(target_os = "windows")]
impl WinForegroundProvider {
    pub(crate) fn new(game_process: String) -> Self {
        Self {
            game_process: game_process.trim().to_lowercase(),
        }
    }
}

#[cfg(target_os = "windows")]
impl ForegroundProvider for WinForegroundProvider {
    fn foreground_pid(&self) -> Option<u32> {
        use windows_sys::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

        let hwnd = unsafe { GetForegroundWindow() };
        if hwnd.is_null() {
            return None;
        }
        let mut pid: u32 = 0;
        unsafe { GetWindowThreadProcessId(hwnd, &mut pid) };
        (pid != 0).then_some(pid)
    }

    fn is_game_process(&self, pid: u32) -> bool {
        running_processes()
            .into_iter()
            .find(|p| p.pid == pid)
            .map(|p| process_name_matches(&self.game_process, &p.name))
            .unwrap_or(false)
    }
}

/// Non-Windows fallback: no foreground window is ever reported, so the monitor
/// never stops a combo (the feature is Windows-only).
#[cfg(not(target_os = "windows"))]
pub(crate) struct NoopForegroundProvider;

#[cfg(not(target_os = "windows"))]
impl ForegroundProvider for NoopForegroundProvider {
    fn foreground_pid(&self) -> Option<u32> {
        None
    }

    fn is_game_process(&self, _pid: u32) -> bool {
        false
    }
}

#[cfg(test)]
#[cfg(target_os = "windows")]
mod tests {
    use std::collections::HashSet;
    use std::time::Duration;

    use parking_lot::Mutex;
    use tauri::{Listener, Manager};

    use super::*;
    use crate::runner::injector::test_utils::MockInjector;
    use crate::runner::potions::PotionConfig;
    use crate::runner::start_combo_inner;

    /// Scripted provider: the test sets the foreground PID and the set of
    /// "game" PIDs, then flips them to simulate the user leaving/returning.
    #[derive(Default)]
    struct MockProvider {
        foreground: Mutex<Option<u32>>,
        game_pids: Mutex<HashSet<u32>>,
    }

    impl MockProvider {
        fn set_foreground(&self, pid: Option<u32>) {
            *self.foreground.lock() = pid;
        }

        fn set_game(&self, pids: impl IntoIterator<Item = u32>) {
            *self.game_pids.lock() = pids.into_iter().collect();
        }
    }

    impl ForegroundProvider for MockProvider {
        fn foreground_pid(&self) -> Option<u32> {
            *self.foreground.lock()
        }

        fn is_game_process(&self, pid: u32) -> bool {
            self.game_pids.lock().contains(&pid)
        }
    }

    fn fast_timing() -> MonitorTiming {
        MonitorTiming {
            poll_interval: Duration::from_millis(5),
            // Windows `thread::sleep` granularity is ~15.6ms without a high-res
            // timer, so sub-grace windows must leave a comfortable margin.
            grace: Duration::from_millis(60),
        }
    }

    fn build_app(state: AppState) -> tauri::App<tauri::test::MockRuntime> {
        tauri::test::mock_builder()
            .manage(state)
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap()
    }

    /// Starts a long-running potions loop (mock injector, no real keys) so the
    /// monitor has channels to guard.
    fn start_looping_combo(app: &tauri::App<tauri::test::MockRuntime>) {
        let handle = app.handle().clone();
        start_combo_inner(
            None, // no auto-stop monitor — tests spawn their own
            Some(PotionConfig::for_test(true, true, true, true, 100, "loop", 1)),
            None,
            &handle,
            &app.state::<AppState>(),
        );
    }

    fn running(state: &AppState) -> bool {
        state.potions.running.load(Ordering::SeqCst) || state.skills.running.load(Ordering::SeqCst)
    }

    /// Polls until the channels stop, or fails after a timeout.
    fn wait_stopped(state: &AppState) {
        let deadline = Instant::now() + Duration::from_secs(5);
        while running(state) {
            assert!(Instant::now() < deadline, "channels never stopped");
            std::thread::sleep(Duration::from_millis(5));
        }
    }

    #[test]
    fn never_stops_before_the_game_has_been_focused() {
        let mut state = AppState::default();
        let (mock, _log) = MockInjector::new_shared();
        state.injector_factory = Arc::new(move || Box::new(MockInjector::with_log(mock.log())));

        let app = build_app(state);
        let handle = app.handle().clone();
        let state = app.state::<AppState>();
        start_looping_combo(&app);

        let provider = Arc::new(MockProvider::default());
        provider.set_game([42]);
        provider.set_foreground(Some(1)); // something else in front, game never seen
        let gen = state.monitor_gen.load(Ordering::SeqCst);
        let _monitor = spawn_focus_monitor_with(fast_timing(), provider, gen, &handle);

        std::thread::sleep(Duration::from_millis(200)); // ≫ grace
        assert!(running(&state), "must not stop before the game was ever focused");
        stop_all_inner(&state);
    }

    #[test]
    fn stops_after_sustained_focus_loss() {
        let mut state = AppState::default();
        let (mock, _log) = MockInjector::new_shared();
        state.injector_factory = Arc::new(move || Box::new(MockInjector::with_log(mock.log())));

        let app = build_app(state);
        let handle = app.handle().clone();
        let state = app.state::<AppState>();
        start_looping_combo(&app);

        let auto_stopped = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let flag = auto_stopped.clone();
        let _unlisten = handle.listen("macro-auto-stopped", move |_| {
            flag.store(true, Ordering::SeqCst);
        });

        let provider = Arc::new(MockProvider::default());
        provider.set_game([42]);
        provider.set_foreground(Some(42)); // in the game
        let gen = state.monitor_gen.load(Ordering::SeqCst);
        let _monitor = spawn_focus_monitor_with(fast_timing(), provider.clone(), gen, &handle);

        std::thread::sleep(Duration::from_millis(100)); // let the game be seen
        provider.set_foreground(Some(1)); // alt-tab away

        wait_stopped(&state);
        // The monitor emits AFTER joining the channel threads, so the event may
        // land a moment after the channels report stopped — poll for it.
        let deadline = Instant::now() + Duration::from_secs(5);
        while !auto_stopped.load(Ordering::SeqCst) {
            assert!(Instant::now() < deadline, "macro-auto-stopped must be emitted");
            std::thread::sleep(Duration::from_millis(5));
        }
        // The join consumed both thread handles — no leaked threads.
        assert!(state.potions.handle.lock().is_none());
        assert!(state.skills.handle.lock().is_none());
    }

    #[test]
    fn transient_focus_loss_under_grace_does_not_stop() {
        let mut state = AppState::default();
        let (mock, _log) = MockInjector::new_shared();
        state.injector_factory = Arc::new(move || Box::new(MockInjector::with_log(mock.log())));

        let app = build_app(state);
        let handle = app.handle().clone();
        let state = app.state::<AppState>();
        start_looping_combo(&app);

        let provider = Arc::new(MockProvider::default());
        provider.set_game([42]);
        provider.set_foreground(Some(42));
        let gen = state.monitor_gen.load(Ordering::SeqCst);
        let _monitor = spawn_focus_monitor_with(fast_timing(), provider.clone(), gen, &handle);

        std::thread::sleep(Duration::from_millis(100)); // game seen

        // Flicker: leave for 3 polls (< grace), come back, leave again briefly.
        for _ in 0..3 {
            provider.set_foreground(Some(1));
            std::thread::sleep(Duration::from_millis(5));
            provider.set_foreground(Some(42));
            std::thread::sleep(Duration::from_millis(5));
        }
        std::thread::sleep(Duration::from_millis(100));
        assert!(running(&state), "transient steals must not stop the combo");
        stop_all_inner(&state);
    }

    #[test]
    fn returns_focus_to_the_game_resets_the_grace_timer() {
        let mut state = AppState::default();
        let (mock, _log) = MockInjector::new_shared();
        state.injector_factory = Arc::new(move || Box::new(MockInjector::with_log(mock.log())));

        let app = build_app(state);
        let handle = app.handle().clone();
        let state = app.state::<AppState>();
        start_looping_combo(&app);

        let provider = Arc::new(MockProvider::default());
        provider.set_game([42]);
        provider.set_foreground(Some(42));
        let gen = state.monitor_gen.load(Ordering::SeqCst);
        let _monitor = spawn_focus_monitor_with(fast_timing(), provider.clone(), gen, &handle);

        std::thread::sleep(Duration::from_millis(100)); // game seen

        // Leave for ~2 sub-grace absences separated by a return. If the grace
        // timer accumulated instead of resetting on each return, the total
        // away time would exceed grace and the combo would stop.
        provider.set_foreground(Some(1));
        std::thread::sleep(Duration::from_millis(30));
        provider.set_foreground(Some(42));
        std::thread::sleep(Duration::from_millis(40));
        provider.set_foreground(Some(1));
        std::thread::sleep(Duration::from_millis(30));
        provider.set_foreground(Some(42));
        std::thread::sleep(Duration::from_millis(100)); // ≫ grace total

        assert!(running(&state), "returning to the game must reset the grace timer");
        stop_all_inner(&state);
    }

    #[test]
    fn exits_when_the_combo_stops_normally() {
        let mut state = AppState::default();
        let (mock, _log) = MockInjector::new_shared();
        state.injector_factory = Arc::new(move || Box::new(MockInjector::with_log(mock.log())));

        let app = build_app(state);
        let handle = app.handle().clone();
        let state = app.state::<AppState>();
        start_looping_combo(&app);

        let provider = Arc::new(MockProvider::default());
        provider.set_game([42]);
        provider.set_foreground(Some(1)); // non-game — but must not matter
        let gen = state.monitor_gen.load(Ordering::SeqCst);
        let monitor = spawn_focus_monitor_with(fast_timing(), provider, gen, &handle);

        stop_all_inner(&state);
        // A monitor guarding a stopped combo must exit on its own, promptly.
        monitor.join().expect("monitor thread must exit after stop");
    }

    #[test]
    fn stale_monitor_cannot_stop_a_newer_combo() {
        let mut state = AppState::default();
        let (mock, _log) = MockInjector::new_shared();
        state.injector_factory = Arc::new(move || Box::new(MockInjector::with_log(mock.log())));

        let app = build_app(state);
        let handle = app.handle().clone();
        let state = app.state::<AppState>();
        start_looping_combo(&app);

        // Old monitor sees the game, then the foreground leaves it.
        let provider = Arc::new(MockProvider::default());
        provider.set_game([42]);
        provider.set_foreground(Some(42));
        let gen = state.monitor_gen.load(Ordering::SeqCst);
        let _old_monitor = spawn_focus_monitor_with(fast_timing(), provider.clone(), gen, &handle);
        std::thread::sleep(Duration::from_millis(100)); // game seen

        // A new combo starts → gen bumps → the old monitor is invalidated.
        state.monitor_gen.fetch_add(1, Ordering::SeqCst);
        provider.set_foreground(Some(1));

        std::thread::sleep(Duration::from_millis(200)); // ≫ grace
        assert!(running(&state), "stale monitor must not stop the new combo");
        stop_all_inner(&state);
    }

    #[test]
    fn no_desktop_foreground_does_not_stop() {
        let mut state = AppState::default();
        let (mock, _log) = MockInjector::new_shared();
        state.injector_factory = Arc::new(move || Box::new(MockInjector::with_log(mock.log())));

        let app = build_app(state);
        let handle = app.handle().clone();
        let state = app.state::<AppState>();
        start_looping_combo(&app);

        let provider = Arc::new(MockProvider::default());
        provider.set_game([42]);
        provider.set_foreground(Some(42));
        let gen = state.monitor_gen.load(Ordering::SeqCst);
        let _monitor = spawn_focus_monitor_with(fast_timing(), provider.clone(), gen, &handle);
        std::thread::sleep(Duration::from_millis(100)); // game seen

        provider.set_foreground(None); // desktop showing (Win+D)
        std::thread::sleep(Duration::from_millis(200));

        assert!(running(&state), "no foreground window must not count as focus loss");
        stop_all_inner(&state);
    }
}
