#include "scr_runtime.h"
#include <assert.h>
#include <math.h>
#include <errno.h>
#include <pthread.h>
#include <stdio.h>
#include <time.h>

#ifdef SCR_LIB
/* This C embedder has no compiler-generated trap overlays. */
const char *const scr_library_trap_overlays[] = { NULL };
const size_t scr_library_trap_overlays_len = 0;
#endif

#ifdef SCR_TEST_CLOCK_FAILURE
/* Inject a failing system epoch-clock read before the runtime constructor. */
int clock_gettime(clockid_t clock, struct timespec *value) {
  if (clock == CLOCK_REALTIME) { errno = EIO; return -1; }
  value->tv_sec = 1;
  value->tv_nsec = 0;
  return 0;
}
#endif

static double origin;

static double realtime_ms(void) {
  struct timespec value;
  assert(clock_gettime(CLOCK_REALTIME, &value) == 0);
  return (double)value.tv_sec * 1000.0 + (double)value.tv_nsec / 1e6;
}

static void check_clock(void) {
  double last = scr_perf_now();
  for (int i = 0; i < 1000; i++) {
    double before = realtime_ms();
    double now = scr_perf_now();
    double after = realtime_ms();
    assert(scr_perf_time_origin() == origin);
    assert(now >= last);
    assert(origin + now >= before - 100.0 && origin + now <= after + 100.0);
    last = now;
  }
}

static void *thread_main(void *unused) {
  (void)unused;
  check_clock();
#ifdef SCR_LIB
  scr_library_reset();
  check_clock();
#endif
  return NULL;
}

int main(void) {
  origin = scr_perf_time_origin();
  assert(isfinite(origin) && origin > 0.0 && origin <= realtime_ms() + 100.0);
  check_clock();
  pthread_t threads[2];
  for (int i = 0; i < 2; i++) assert(pthread_create(&threads[i], NULL, thread_main, NULL) == 0);
  for (int i = 0; i < 2; i++) assert(pthread_join(threads[i], NULL) == 0);
  check_clock();
  puts("epoch origin is immutable and shared by monotonic clocks across threads");
  return 0;
}
