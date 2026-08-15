use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

use enigo::Key;
use serde::Deserialize;
use tauri::{AppHandle, Emitter, Runtime};

use super::injector::{parse_key, KeyInjector, KeyReleaseGuard};
use super::timing::{set_high_priority, sleep_precise};
use super::AppState;

#[derive(Deserialize, Clone)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum SkillStep {
    #[serde(rename = "keydown")]
    KeyDown { key: String },
    #[serde(rename = "keyup")]
    KeyUp { key: String },
    #[serde(rename = "delay")]
    Delay { ms: u64 },
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SkillConfig {
    pub(crate) hold_right_click: bool,
    pub(crate) steps: Vec<SkillStep>,
    pub(crate) repeat_mode: String,
    pub(crate) repeat_count: u64,
}

#[cfg(test)]
impl SkillConfig {
    pub(crate) fn for_test(
        steps: Vec<SkillStep>,
        hold_right_click: bool,
        repeat_mode: &str,
        repeat_count: u64,
    ) -> Self {
        SkillConfig {
            hold_right_click,
            steps,
            repeat_mode: repeat_mode.to_string(),
            repeat_count,
        }
    }
}

/// Collects the injectable keys of every key step (keydown or keyup). Keys that
/// fail to parse were never pressed, so they're excluded from release cleanup.
fn step_keys(steps: &[SkillStep]) -> Vec<Key> {
    let mut keys = Vec::new();
    for step in steps {
        if let SkillStep::KeyDown { key } | SkillStep::KeyUp { key } = step {
            if let Some(key) = parse_key(key) {
                keys.push(key);
            }
        }
    }
    keys
}

/// Skills loop: optionally holds right-click for the whole run, then executes the
/// step list (delay/keydown/keyup) each cycle. Emits `macro-activation` every
/// cycle and `macro-finished` once when Repeat-N is reached.
///
/// All presses go through a [`KeyReleaseGuard`], whose `Drop` releases the
/// right-click and every step key on normal return, Repeat-N completion,
/// cancellation, or panic.
fn run_skills<R: Runtime>(
    config: SkillConfig,
    app: AppHandle<R>,
    running: Arc<AtomicBool>,
    session_id: u64,
    injector: &mut dyn KeyInjector,
) {
    set_high_priority();

    let mut cycle: u64 = 0;
    let mut last_progress = Instant::now() - Duration::from_millis(16);

    let mut guard =
        KeyReleaseGuard::new(injector, step_keys(&config.steps), config.hold_right_click);

    if config.hold_right_click {
        guard.press_right_click();
    }

    while running.load(Ordering::SeqCst) {
        for (step_index, step) in config.steps.iter().enumerate() {
            if !running.load(Ordering::SeqCst) {
                break;
            }
            // Progress is visual-only. Cap it near 60 Hz so zero-delay loops
            // cannot overwhelm the webview or affect injection timing.
            if last_progress.elapsed() >= Duration::from_millis(16) {
                let _ = app.emit(
                    "macro-step",
                    serde_json::json!({ "sessionId": session_id, "stepIndex": step_index }),
                );
                last_progress = Instant::now();
            }
            match step {
                SkillStep::Delay { ms } => {
                    sleep_precise(*ms, &running);
                }
                SkillStep::KeyDown { key } => {
                    if let Some(key) = parse_key(key) {
                        guard.press(key);
                    }
                }
                SkillStep::KeyUp { key } => {
                    if let Some(key) = parse_key(key) {
                        guard.release(key);
                    }
                }
            }
        }
        cycle += 1;
        let _ = app.emit(
            "macro-activation",
            serde_json::json!({ "channel": "skills", "cycle": cycle }),
        );

        if config.repeat_mode == "count" && cycle >= config.repeat_count.max(1) {
            let _ = app.emit(
                "macro-finished",
                serde_json::json!({ "channel": "skills", "cycle": cycle, "reason": "repeat-complete" }),
            );
            running.store(false, Ordering::SeqCst);
            break;
        }
    }
    // guard drops here: releases right-click then all step keys
}

/// Spawns the skills loop on a dedicated thread. The caller is responsible for
/// stopping the channel beforehand (see `start_combo`).
pub(crate) fn spawn_skills<R: Runtime>(
    config: SkillConfig,
    app: &AppHandle<R>,
    state: &AppState,
    session_id: u64,
) {
    if config.steps.is_empty() {
        return;
    }

    let running = state.skills.running.clone();
    running.store(true, Ordering::SeqCst);

    let mut injector = (state.injector_factory)();
    let app = app.clone();
    let handle = thread::spawn(move || run_skills(config, app, running, session_id, &mut *injector));

    *state.skills.handle.lock() = Some(handle);
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
    fn recorded_special_keys_round_trip_through_the_loop() {
        // Regression: the recorder emits "Space"/"F1"/"PageUp"… and these used
        // to be truncated to their first character ('S'/'F'/'P') before injection.
        let mut injector = MockInjector::default();
        let running = Arc::new(AtomicBool::new(true));

        run_skills(
            SkillConfig::for_test(
                vec![
                    SkillStep::KeyDown {
                        key: "Space".into(),
                    },
                    SkillStep::KeyUp {
                        key: "Space".into(),
                    },
                    SkillStep::KeyDown { key: "F1".into() },
                    SkillStep::KeyUp { key: "F1".into() },
                ],
                false,
                "count",
                1,
            ),
            app_handle(),
            running.clone(),
            1,
            &mut injector,
        );

        assert_eq!(
            injector.log().lock().clone(),
            vec![
                InjectedEvent::Press(Key::Space),
                InjectedEvent::Release(Key::Space),
                InjectedEvent::Press(Key::F1),
                InjectedEvent::Release(Key::F1),
                // cleanup releases every step key occurrence (one per step)
                InjectedEvent::Release(Key::Space),
                InjectedEvent::Release(Key::Space),
                InjectedEvent::Release(Key::F1),
                InjectedEvent::Release(Key::F1),
            ]
        );
    }

    #[test]
    fn unknown_step_keys_are_skipped_but_do_not_break_the_loop() {
        let mut injector = MockInjector::default();
        let running = Arc::new(AtomicBool::new(true));

        run_skills(
            SkillConfig::for_test(
                vec![
                    SkillStep::KeyDown {
                        key: "VK_999".into(),
                    },
                    SkillStep::Delay { ms: 0 },
                    SkillStep::KeyDown { key: "1".into() },
                    SkillStep::KeyUp { key: "1".into() },
                ],
                false,
                "count",
                1,
            ),
            app_handle(),
            running.clone(),
            1,
            &mut injector,
        );

        assert_eq!(
            injector.log().lock().clone(),
            vec![
                InjectedEvent::Press(Key::Unicode('1')),
                InjectedEvent::Release(Key::Unicode('1')),
                InjectedEvent::Release(Key::Unicode('1')),
                InjectedEvent::Release(Key::Unicode('1')),
            ],
            "unparseable keys must be ignored and parseable ones must still run"
        );
    }

    #[test]
    fn skill_step_deserializes_from_frontend_json() {
        let down: SkillStep = serde_json::from_str(r#"{"type":"keydown","key":"1"}"#).unwrap();
        assert!(matches!(down, SkillStep::KeyDown { key } if key == "1"));

        let up: SkillStep = serde_json::from_str(r#"{"type":"keyup","key":"x"}"#).unwrap();
        assert!(matches!(up, SkillStep::KeyUp { key } if key == "x"));

        // The frontend sends ms as a number here (toRunnerInputs converts);
        // strings are rejected by serde for the tagged enum.
        let delay_num: SkillStep = serde_json::from_str(r#"{"type":"delay","ms":120}"#).unwrap();
        assert!(matches!(delay_num, SkillStep::Delay { ms } if ms == 120));

        assert!(
            serde_json::from_str::<SkillStep>(r#"{"type":"delay","ms":"120"}"#).is_err(),
            "string ms must not deserialize into the u64 delay"
        );
    }

    #[test]
    fn runs_steps_in_order_with_right_click_hold_and_cleanup() {
        let mut injector = MockInjector::default();
        let running = Arc::new(AtomicBool::new(true));

        run_skills(
            SkillConfig::for_test(
                vec![
                    SkillStep::KeyDown { key: "1".into() },
                    SkillStep::Delay { ms: 0 },
                    SkillStep::KeyUp { key: "1".into() },
                    SkillStep::KeyDown { key: "2".into() },
                ],
                true,
                "count",
                1,
            ),
            app_handle(),
            running.clone(),
            1,
            &mut injector,
        );

        assert_eq!(
            injector.log().lock().clone(),
            vec![
                InjectedEvent::PressRightClick,
                InjectedEvent::Press(Key::Unicode('1')),
                InjectedEvent::Release(Key::Unicode('1')),
                InjectedEvent::Press(Key::Unicode('2')),
                InjectedEvent::ReleaseRightClick,
                InjectedEvent::Release(Key::Unicode('1')),
                InjectedEvent::Release(Key::Unicode('1')),
                InjectedEvent::Release(Key::Unicode('2')),
            ]
        );
        assert!(!running.load(Ordering::SeqCst));
    }

    #[test]
    fn cancelled_loop_releases_right_click_and_all_step_keys() {
        let mut injector = MockInjector::default();
        let log = injector.log();
        let running = Arc::new(AtomicBool::new(true));
        let running_clone = running.clone();

        let handle = std::thread::spawn(move || {
            run_skills(
                SkillConfig::for_test(
                    vec![
                        SkillStep::KeyDown { key: "1".into() },
                        SkillStep::Delay { ms: 100 },
                        SkillStep::KeyUp { key: "1".into() },
                    ],
                    true,
                    "loop",
                    1,
                ),
                app_handle(),
                running_clone,
                1,
                &mut injector,
            )
        });

        std::thread::sleep(std::time::Duration::from_millis(30));
        running.store(false, Ordering::SeqCst);
        handle.join().unwrap();

        let events = log.lock().clone();
        assert_eq!(
            events.last().unwrap(),
            &InjectedEvent::Release(Key::Unicode('1')),
            "cleanup must release step keys last"
        );
        assert!(
            events.contains(&InjectedEvent::ReleaseRightClick),
            "held right-click must be released on cancellation"
        );
    }

    #[test]
    fn activation_event_fired_every_cycle() {
        let handle = app_handle();
        let count = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let count_clone = count.clone();
        let _unlisten = handle.listen("macro-activation", move |_| {
            count_clone.fetch_add(1, Ordering::SeqCst);
        });

        let mut injector = MockInjector::default();
        let running = Arc::new(AtomicBool::new(true));

        run_skills(
            SkillConfig::for_test(
                vec![
                    SkillStep::KeyDown { key: "1".into() },
                    SkillStep::Delay { ms: 0 },
                    SkillStep::KeyUp { key: "1".into() },
                ],
                false,
                "count",
                5,
            ),
            handle,
            running.clone(),
            1,
            &mut injector,
        );

        assert_eq!(
            count.load(Ordering::SeqCst),
            5,
            "skills activation fires every cycle"
        );
    }

    #[test]
    fn empty_steps_are_not_spawned() {
        let state = AppState::default();
        let app = app_handle();

        spawn_skills(
            SkillConfig::for_test(vec![], false, "loop", 1),
            &app,
            &state,
            1,
        );

        assert!(
            state.skills.handle.lock().is_none(),
            "empty skill combos must not spawn a thread"
        );
        assert!(!state.skills.running.load(Ordering::SeqCst));
    }
}
