use std::hint;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::{Duration, Instant};

extern "system" {
    fn timeBeginPeriod(uPeriod: u32) -> u32;
    fn GetCurrentThread() -> isize;
    fn SetThreadPriority(hThread: isize, nPriority: i32) -> i32;
}

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

pub(crate) fn sleep_precise(ms: u64, running: &AtomicBool) {
    if ms == 0 {
        return;
    }

    let target = Instant::now() + Duration::from_millis(ms);

    loop {
        if !running.load(Ordering::SeqCst) {
            return;
        }

        let now = Instant::now();
        if now >= target {
            break;
        }

        let remaining = target - now;
        if remaining > Duration::from_millis(2) {
            thread::sleep(Duration::from_millis(1));
        } else if remaining > Duration::from_micros(500) {
            thread::yield_now();
        } else {
            hint::spin_loop();
        }
    }
}
