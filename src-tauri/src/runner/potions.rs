use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;

use enigo::Key;
use serde::Deserialize;
use tauri::{AppHandle, Emitter, Runtime};

use super::injector::{KeyInjector, KeyReleaseGuard};
use super::timing::{set_high_priority, sleep_precise};
use super::AppState;

#[derive(Deserialize, Clone)]
pub(crate) struct Keys {
    pub(crate) q: bool,
    pub(crate) w: bool,
    pub(crate) e: bool,
    pub(crate) r: bool,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PotionConfig {
    pub(crate) keys: Keys,
    pub(crate) delay_ms: u64,
    pub(crate) repeat_mode: String,
    pub(crate) repeat_count: u64,
}

#[cfg(test)]
impl PotionConfig {
    pub(crate) fn for_test(
        q: bool,
        w: bool,
        e: bool,
        r: bool,
        delay_ms: u64,
        repeat_mode: &str,
        repeat_count: u64,
    ) -> Self {
        PotionConfig {
            keys: Keys { q, w, e, r },
            delay_ms,
            repeat_mode: repeat_mode.to_string(),
            repeat_count,
        }
    }
}

fn enabled_potion_keys(keys: &Keys) -> Vec<char> {
    let mut seq = Vec::new();
    if keys.q {
        seq.push('q');
    }
    if keys.w {
        seq.push('w');
    }
    if keys.e {
        seq.push('e');
    }
    if keys.r {
        seq.push('r');
    }
    seq
}

/// Potions loop: per cycle, press each enabled key in q→w→e→r order, wait
/// `delay_ms`, release. Emits `macro-activation` every 10 cycles (throttle) and
/// `macro-finished` once when Repeat-N is reached.
///
/// All presses go through a [`KeyReleaseGuard`], whose `Drop` releases the full
/// sequence on normal return, Repeat-N completion, cancellation, or panic.
fn run_potions<R: Runtime>(
    config: PotionConfig,
    app: AppHandle<R>,
    running: Arc<AtomicBool>,
    injector: &mut dyn KeyInjector,
) {
    set_high_priority();

    let sequence = enabled_potion_keys(&config.keys);
    if sequence.is_empty() {
        running.store(false, Ordering::SeqCst);
        return;
    }

    let mut guard = KeyReleaseGuard::new(
        injector,
        sequence.iter().map(|c| Key::Unicode(*c)).collect(),
        false,
    );

    let mut cycle: u64 = 0;

    while running.load(Ordering::SeqCst) {
        for ch in &sequence {
            if !running.load(Ordering::SeqCst) {
                break;
            }
            guard.press(Key::Unicode(*ch));
            sleep_precise(config.delay_ms, &running);
            guard.release(Key::Unicode(*ch));
        }
        cycle += 1;
        if cycle % 10 == 0 {
            let _ = app.emit(
                "macro-activation",
                serde_json::json!({ "channel": "potions", "cycle": cycle, "keys": sequence }),
            );
        }

        if config.repeat_mode == "count" && cycle >= config.repeat_count.max(1) {
            let _ = app.emit(
                "macro-finished",
                serde_json::json!({ "channel": "potions", "cycle": cycle, "reason": "repeat-complete" }),
            );
            running.store(false, Ordering::SeqCst);
            break;
        }
    }
    // guard drops here: releases the full sequence
}

/// Spawns the potions loop on a dedicated thread. The caller is responsible for
/// stopping the channel beforehand (see `start_combo`).
pub(crate) fn spawn_potions<R: Runtime>(
    config: PotionConfig,
    app: &AppHandle<R>,
    state: &AppState,
) {
    let running = state.potions.running.clone();
    running.store(true, Ordering::SeqCst);

    let mut injector = (state.injector_factory)();
    let app = app.clone();
    let handle = thread::spawn(move || run_potions(config, app, running, &mut *injector));

    *state.potions.handle.lock() = Some(handle);
}

#[cfg(test)]
#[cfg(target_os = "windows")]
mod tests {
    use std::sync::atomic::AtomicBool;
    use std::sync::Arc;

    use tauri::Listener;

    use super::*;
    use crate::runner::injector::test_utils::{InjectedEvent, MockInjector};

    fn app_handle() -> tauri::AppHandle<tauri::test::MockRuntime> {
        tauri::test::mock_builder()
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap()
            .handle()
            .clone()
    }

    #[test]
    fn enabled_keys_preserve_qwer_order() {
        let all = Keys {
            q: true,
            w: true,
            e: true,
            r: true,
        };
        assert_eq!(enabled_potion_keys(&all), vec!['q', 'w', 'e', 'r']);

        let subset = Keys {
            q: true,
            w: false,
            e: true,
            r: false,
        };
        assert_eq!(enabled_potion_keys(&subset), vec!['q', 'e']);

        let none = Keys {
            q: false,
            w: false,
            e: false,
            r: false,
        };
        assert!(enabled_potion_keys(&none).is_empty());
    }

    #[test]
    fn count_mode_runs_exact_sequence_then_stops() {
        let mut injector = MockInjector::default();
        let running = Arc::new(AtomicBool::new(true));

        run_potions(
            PotionConfig::for_test(true, true, false, false, 0, "count", 1),
            app_handle(),
            running.clone(),
            &mut injector,
        );

        assert_eq!(
            injector.log().lock().clone(),
            vec![
                InjectedEvent::Press(Key::Unicode('q')),
                InjectedEvent::Release(Key::Unicode('q')),
                InjectedEvent::Press(Key::Unicode('w')),
                InjectedEvent::Release(Key::Unicode('w')),
                // guard cleanup on loop exit
                InjectedEvent::Release(Key::Unicode('q')),
                InjectedEvent::Release(Key::Unicode('w')),
            ]
        );
        assert!(
            !running.load(Ordering::SeqCst),
            "loop must stop after Repeat-N"
        );
    }

    #[test]
    fn count_zero_clamps_to_one_cycle() {
        let mut injector = MockInjector::default();
        let running = Arc::new(AtomicBool::new(true));

        run_potions(
            PotionConfig::for_test(true, false, false, false, 0, "count", 0),
            app_handle(),
            running.clone(),
            &mut injector,
        );

        let events = injector.log().lock().clone();
        assert_eq!(
            events,
            vec![
                InjectedEvent::Press(Key::Unicode('q')),
                InjectedEvent::Release(Key::Unicode('q')),
                InjectedEvent::Release(Key::Unicode('q')),
            ]
        );
    }

    #[test]
    fn loop_mode_releases_all_keys_when_cancelled() {
        let mut injector = MockInjector::default();
        let log = injector.log();
        let running = Arc::new(AtomicBool::new(true));
        let running_clone = running.clone();

        let handle = std::thread::spawn(move || {
            run_potions(
                PotionConfig::for_test(true, true, true, true, 100, "loop", 1),
                app_handle(),
                running_clone,
                &mut injector,
            )
        });

        std::thread::sleep(std::time::Duration::from_millis(30));
        running.store(false, Ordering::SeqCst);
        handle.join().unwrap();

        let events = log.lock().clone();
        assert!(
            !events.is_empty(),
            "loop should have injected before cancellation"
        );
        // Every pressed key must be released (mid-loop or cleanup), and the
        // cleanup pass releases the full sequence last.
        let mut pressed = std::collections::HashMap::new();
        for e in &events {
            match e {
                InjectedEvent::Press(k) => *pressed.entry(*k).or_insert(0i32) += 1,
                InjectedEvent::Release(k) => *pressed.entry(*k).or_insert(0i32) -= 1,
                _ => {}
            }
        }
        assert!(
            pressed.values().all(|v| *v <= 0),
            "every pressed key must be released: {pressed:?}"
        );
        assert!(
            events.ends_with(&[
                InjectedEvent::Release(Key::Unicode('q')),
                InjectedEvent::Release(Key::Unicode('w')),
                InjectedEvent::Release(Key::Unicode('e')),
                InjectedEvent::Release(Key::Unicode('r')),
            ]),
            "cleanup must release the full sequence last"
        );
        assert!(
            !running.load(Ordering::SeqCst),
            "cancelled loop must clear running"
        );
    }

    #[test]
    fn empty_keys_stop_immediately_without_injecting() {
        let mut injector = MockInjector::default();
        let running = Arc::new(AtomicBool::new(true));

        run_potions(
            PotionConfig::for_test(false, false, false, false, 0, "loop", 1),
            app_handle(),
            running.clone(),
            &mut injector,
        );

        assert!(!running.load(Ordering::SeqCst));
        assert!(injector.log().lock().is_empty());
    }

    #[test]
    fn activation_event_throttled_to_every_10_cycles() {
        let handle = app_handle();
        let count = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let count_clone = count.clone();
        let _unlisten = handle.listen("macro-activation", move |_| {
            count_clone.fetch_add(1, Ordering::SeqCst);
        });

        let mut injector = MockInjector::default();
        let running = Arc::new(AtomicBool::new(true));

        // 25 cycles → activations at cycle 10 and 20 only.
        run_potions(
            PotionConfig::for_test(true, true, true, true, 0, "count", 25),
            handle,
            running.clone(),
            &mut injector,
        );

        assert_eq!(
            count.load(Ordering::SeqCst),
            2,
            "potions activation must be throttled to every 10th cycle"
        );
    }
}
