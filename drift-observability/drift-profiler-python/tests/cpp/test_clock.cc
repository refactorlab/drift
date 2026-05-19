// Unit tests for src/clock.{h,cc}.
//
// clock.cc contains pure POSIX helpers — no Python C API needed. We
// link directly against the same .cc file the wheel ships.

#include "../../driftdockerprofiler/src/clock.h"
#include "check.h"

// --------------------------------------------------------------- NanosToTimeSpec

TEST(NanosToTimeSpec_zero) {
  struct timespec t = NanosToTimeSpec(0);
  CHECK_EQ(t.tv_sec, 0);
  CHECK_EQ(t.tv_nsec, 0);
}

TEST(NanosToTimeSpec_sub_second) {
  struct timespec t = NanosToTimeSpec(500);
  CHECK_EQ(t.tv_sec, 0);
  CHECK_EQ(t.tv_nsec, 500);
}

TEST(NanosToTimeSpec_exactly_one_second) {
  struct timespec t = NanosToTimeSpec(kNanosPerSecond);
  CHECK_EQ(t.tv_sec, 1);
  CHECK_EQ(t.tv_nsec, 0);
}

TEST(NanosToTimeSpec_multi_second_with_remainder) {
  // 2 s + 500 ns
  struct timespec t = NanosToTimeSpec(2 * kNanosPerSecond + 500);
  CHECK_EQ(t.tv_sec, 2);
  CHECK_EQ(t.tv_nsec, 500);
}

// --------------------------------------------------------------- TimeAdd

TEST(TimeAdd_no_carry) {
  struct timespec a = {1, 100};
  struct timespec b = {2, 200};
  struct timespec r = TimeAdd(a, b);
  CHECK_EQ(r.tv_sec, 3);
  CHECK_EQ(r.tv_nsec, 300);
}

TEST(TimeAdd_with_carry) {
  // nanos overflow → carry into seconds
  struct timespec a = {1, kNanosPerSecond - 1};   // 1.999999999
  struct timespec b = {2, 5};                     // 2.000000005
  struct timespec r = TimeAdd(a, b);
  CHECK_EQ(r.tv_sec, 4);
  CHECK_EQ(r.tv_nsec, 4);
}

TEST(TimeAdd_zero_is_identity) {
  struct timespec a = {7, 42};
  struct timespec z = {0, 0};
  struct timespec r = TimeAdd(a, z);
  CHECK_EQ(r.tv_sec, 7);
  CHECK_EQ(r.tv_nsec, 42);
}

// --------------------------------------------------------------- TimeLessThan

TEST(TimeLessThan_strict_inequality) {
  struct timespec a = {1, 100};
  struct timespec b = {1, 200};
  CHECK(TimeLessThan(a, b));
  CHECK(!TimeLessThan(b, a));
}

TEST(TimeLessThan_equal_is_not_less) {
  struct timespec a = {1, 100};
  struct timespec b = {1, 100};
  CHECK(!TimeLessThan(a, b));
  CHECK(!TimeLessThan(b, a));
}

TEST(TimeLessThan_seconds_dominate) {
  // 1.999999999 < 2.000000000
  struct timespec a = {1, kNanosPerSecond - 1};
  struct timespec b = {2, 0};
  CHECK(TimeLessThan(a, b));
  CHECK(!TimeLessThan(b, a));
}

// --------------------------------------------------------------- DefaultClock

TEST(DefaultClock_returns_non_null_singleton) {
  Clock *a = DefaultClock();
  Clock *b = DefaultClock();
  CHECK(a != nullptr);
  CHECK(a == b);   // same pointer across calls
}

TEST(DefaultClock_Now_is_monotonic_across_back_to_back_calls) {
  Clock *c = DefaultClock();
  struct timespec t1 = c->Now();
  struct timespec t2 = c->Now();
  // Either t1 < t2 or t1 == t2 (clock resolution may be coarse).
  CHECK(!TimeLessThan(t2, t1));
}
