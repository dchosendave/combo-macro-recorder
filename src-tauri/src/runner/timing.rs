use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

extern "system" {
    fn timeBeginPeriod(uPeriod: u32) -> u32;
    fn GetCurrentThread() -> isize;
    fn SetThreadPriority(hThread: isize, nPriority: i32) -> i32;

    // Waitable timer API (replaces thread::sleep for precise timing)
    fn CreateWaitableTimerExW(
        lpTimerAttributes: *const std::ffi::c_void,
        lpTimerName: *const u16,
        dwFlags: u32,
        dwDesiredAccess: u32,
    ) -> isize;
    fn SetWaitableTimer(
        hTimer: isize,
        lpDueTime: *const i64,
        lPeriod: i32,
        pfnCompletionRoutine: Option<unsafe extern "system" fn()>,
        lpArgToCompletionRoutine: *const std::ffi::c_void,
        fResume: i32,
    ) -> i32;
    fn WaitForSingleObject(hHandle: isize, dwMilliseconds: u32) -> u32;
    fn CloseHandle(hObject: isize) -> i32;
}

const WAIT_OBJECT_0: u32 = 0;
const TIMER_ALL_ACCESS: u32 = 0x1F0003;

pub fn init_timing() {
    unsafe {
        timeBeginPeriod(1);
    }
}

pub(crate) fn set_high_priority() {
    unsafe {
        let thread = GetCurrentThread();
        SetThreadPriority(thread, 2);
    }
}

/// Sleeps for approximately `ms` milliseconds using a Windows waitable timer.
///
/// Uses `CreateWaitableTimerExW` + `SetWaitableTimer` + `WaitForSingleObject`
/// so the thread blocks efficiently and wakes with sub-millisecond precision
/// (~100µs jitter), unlike the old spin-sleep approach which had cumulative
/// drift from `thread::sleep(1)` and unbounded spikes from `thread::yield_now()`.
///
/// Checks `running` on a 1ms poll so cancellation still works promptly.
/// Falls back to a spin-loop if timer creation fails (edge case).
///
/// See https://learn.microsoft.com/en-us/windows/win32/sync/waitable-timer-objects
pub(crate) fn sleep_precise(ms: u64, running: &AtomicBool) {
    if ms == 0 {
        return;
    }

    // Build a relative negative due time in 100ns intervals.
    // SetWaitableTimer interprets negative values as relative time from "now".
    let due_time: i64 = -(ms as i64) * 10_000;

    unsafe {
        let timer = CreateWaitableTimerExW(
            std::ptr::null(),
            std::ptr::null(),
            0, // auto-reset timer
            TIMER_ALL_ACCESS,
        );
        if timer == 0 || timer == -1 {
            // Fallback: spin-loop if timer creation fails
            fallback_spin(ms, running);
            return;
        }

        let ok = SetWaitableTimer(timer, &due_time, 0, None, std::ptr::null(), 0);
        if ok == 0 {
            CloseHandle(timer);
            fallback_spin(ms, running);
            return;
        }

        // Wait for the timer to fire.
        // Poll at 1ms to keep cancellation responsive.
        loop {
            let result = WaitForSingleObject(timer, 1);
            if result == WAIT_OBJECT_0 {
                break; // Timer fired — we're done
            }
            if !running.load(Ordering::SeqCst) {
                break; // Cancelled
            }
            // WAIT_TIMEOUT (258) → poll again
        }

        CloseHandle(timer);
    }
}

/// Spin-loop fallback used when the waitable timer can't be created.
/// Same behaviour as the old implementation but without `thread::yield_now()`
/// to avoid the scheduler-spike problem.
fn fallback_spin(ms: u64, running: &AtomicBool) {
    let target = Instant::now() + Duration::from_millis(ms);
    while Instant::now() < target {
        if !running.load(Ordering::SeqCst) {
            return;
        }
        std::hint::spin_loop();
    }
}

#[cfg(test)]
#[cfg(target_os = "windows")]
mod tests {
    use std::sync::atomic::AtomicBool;
    use std::sync::Arc;
    use std::time::Instant;

    use super::*;

    #[test]
    fn zero_delay_returns_immediately() {
        let running = Arc::new(AtomicBool::new(true));
        let start = Instant::now();
        sleep_precise(0, &running);
        assert!(start.elapsed() < Duration::from_millis(50));
    }

    #[test]
    fn sleeps_approximately_the_requested_duration() {
        let running = Arc::new(AtomicBool::new(true));
        let start = Instant::now();
        sleep_precise(200, &running);
        let elapsed = start.elapsed();
        assert!(elapsed >= Duration::from_millis(150), "slept only {elapsed:?}");
        assert!(elapsed <= Duration::from_millis(1000), "slept {elapsed:?}, way too long");
    }

    #[test]
    fn cancellation_returns_promptly() {
        let running = Arc::new(AtomicBool::new(true));
        let running_clone = running.clone();

        let start = Instant::now();
        let handle = std::thread::spawn(move || sleep_precise(2000, &running_clone));

        std::thread::sleep(Duration::from_millis(50));
        running.store(false, Ordering::SeqCst);
        handle.join().unwrap();

        assert!(
            start.elapsed() < Duration::from_millis(1000),
            "cancelled sleep must not wait out the full duration"
        );
    }

    #[test]
    fn fallback_spin_sleeps_approximately_the_requested_duration() {
        let running = Arc::new(AtomicBool::new(true));
        let start = Instant::now();
        fallback_spin(80, &running);
        let elapsed = start.elapsed();
        // ±40% tolerance, mirroring the style of the sleep_precise test above.
        assert!(elapsed >= Duration::from_millis(48), "returned too early: {elapsed:?}");
        assert!(elapsed <= Duration::from_millis(500), "slept {elapsed:?}, way too long");
    }

    #[test]
    fn fallback_spin_returns_promptly_when_cancelled() {
        let running = Arc::new(AtomicBool::new(true));
        let running_clone = running.clone();

        let start = Instant::now();
        let handle = std::thread::spawn(move || fallback_spin(1000, &running_clone));

        std::thread::sleep(Duration::from_millis(5));
        running.store(false, Ordering::SeqCst);
        handle.join().unwrap();

        assert!(
            start.elapsed() < Duration::from_millis(100),
            "cancelled spin must return well before the full duration"
        );
    }
}
