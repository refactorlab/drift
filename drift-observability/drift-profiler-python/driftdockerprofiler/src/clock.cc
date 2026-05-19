

#include "clock.h"

namespace {
Clock DefaultClockInstance;
}  // namespace

Clock *DefaultClock() { return &DefaultClockInstance; }

struct timespec TimeAdd(const struct timespec t1, const struct timespec t2) {
  struct timespec t = {t1.tv_sec + t2.tv_sec, t1.tv_nsec + t2.tv_nsec};
  if (t.tv_nsec > kNanosPerSecond) {
    t.tv_sec += t.tv_nsec / kNanosPerSecond;
    t.tv_nsec = t.tv_nsec % kNanosPerSecond;
  }
  return t;
}

bool TimeLessThan(const struct timespec &t1, const struct timespec &t2) {
  return (t1.tv_sec < t2.tv_sec) ||
         (t1.tv_sec == t2.tv_sec && t1.tv_nsec < t2.tv_nsec);
}

struct timespec NanosToTimeSpec(int64_t nanos) {
  time_t seconds = nanos / kNanosPerSecond;
  int32_t nano_seconds = nanos % kNanosPerSecond;
  return timespec{seconds, nano_seconds};
}
