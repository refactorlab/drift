// Unit tests for src/stacktraces.{h,cc}.
//
// `stacktraces.h` includes <Python.h> for the PyCodeObject* type used
// inside CallFrame. We never DEREFERENCE py_code — Add()/Extract() and
// Equal()/CalculateHash() treat it as an opaque pointer (identity
// only). So we can fabricate CallFrame values with arbitrary integer
// pointer values and exercise the data structure without booting a
// Python interpreter.

#include <Python.h>

#include "../../driftdockerprofiler/src/stacktraces.h"
#include "check.h"

namespace {

// Build a synthetic CallFrame. `code` is reinterpreted as an opaque
// PyCodeObject* — the multiset only uses it for identity comparison.
CallFrame F(int line, uintptr_t code) {
  CallFrame f;
  f.lineno = line;
  f.py_code = reinterpret_cast<PyCodeObject *>(code);
  return f;
}

}  // namespace

// --------------------------------------------------------------- CalculateHash + Equal

TEST(CalculateHash_same_frames_produce_same_hash) {
  CallFrame f1[] = {F(1, 0x100), F(2, 0x200)};
  CallFrame f2[] = {F(1, 0x100), F(2, 0x200)};
  CHECK_EQ(CalculateHash(2, f1), CalculateHash(2, f2));
}

TEST(CalculateHash_different_lineno_differs) {
  CallFrame f1[] = {F(1, 0x100)};
  CallFrame f2[] = {F(2, 0x100)};
  // Not strictly required by spec — a hash CAN collide — but for these
  // specific inputs we'd expect distinct values from a sane hash.
  CHECK_NE(CalculateHash(1, f1), CalculateHash(1, f2));
}

TEST(CalculateHash_different_code_pointer_differs) {
  CallFrame f1[] = {F(7, 0xAAA)};
  CallFrame f2[] = {F(7, 0xBBB)};
  CHECK_NE(CalculateHash(1, f1), CalculateHash(1, f2));
}

TEST(Equal_matches_identical_frames) {
  CallFrame f1[] = {F(1, 0x100), F(2, 0x200)};
  CallFrame f2[] = {F(1, 0x100), F(2, 0x200)};
  CHECK(Equal(2, f1, f2));
}

TEST(Equal_distinguishes_different_lineno) {
  CallFrame f1[] = {F(1, 0x100), F(2, 0x200)};
  CallFrame f2[] = {F(1, 0x100), F(3, 0x200)};
  CHECK(!Equal(2, f1, f2));
}

TEST(Equal_distinguishes_different_code_pointer) {
  CallFrame f1[] = {F(1, 0x100)};
  CallFrame f2[] = {F(1, 0x200)};
  CHECK(!Equal(1, f1, f2));
}

// --------------------------------------------------------------- AsyncSafeTraceMultiset

TEST(AsyncSafeTraceMultiset_add_then_extract_one_trace) {
  AsyncSafeTraceMultiset m;
  CallFrame frames[] = {F(10, 0xa), F(20, 0xb)};
  CallTrace trace = {2, frames};
  CHECK(m.Add(&trace));
  CHECK(m.Add(&trace));
  CHECK(m.Add(&trace));    // count should be 3

  CallFrame out[kMaxFramesToCapture];
  int64_t count = 0;
  int found_locations = 0;
  for (int loc = 0; loc < m.MaxEntries(); loc++) {
    int n = m.Extract(loc, kMaxFramesToCapture, out, &count);
    if (n > 0) {
      found_locations++;
      CHECK_EQ(n, 2);
      CHECK_EQ(count, 3);
      CHECK_EQ(out[0].lineno, 10);
      CHECK_EQ(out[1].lineno, 20);
    }
  }
  CHECK_EQ(found_locations, 1);
}

TEST(AsyncSafeTraceMultiset_distinct_traces_distinct_slots) {
  AsyncSafeTraceMultiset m;
  CallFrame f1[] = {F(1, 0x100)};
  CallFrame f2[] = {F(2, 0x200)};
  CallTrace t1 = {1, f1};
  CallTrace t2 = {1, f2};
  CHECK(m.Add(&t1));
  CHECK(m.Add(&t2));
  CHECK(m.Add(&t1));    // t1 count = 2, t2 count = 1

  CallFrame out[kMaxFramesToCapture];
  int64_t count = 0;
  int seen = 0;
  int64_t total_count = 0;
  for (int loc = 0; loc < m.MaxEntries(); loc++) {
    int n = m.Extract(loc, kMaxFramesToCapture, out, &count);
    if (n > 0) {
      seen++;
      total_count += count;
    }
  }
  CHECK_EQ(seen, 2);
  CHECK_EQ(total_count, 3);
}

TEST(AsyncSafeTraceMultiset_extract_empty_slot_returns_zero) {
  AsyncSafeTraceMultiset m;
  CallFrame out[kMaxFramesToCapture];
  int64_t count = 99;   // sentinel — Extract should leave alone or zero
  int n = m.Extract(0, kMaxFramesToCapture, out, &count);
  CHECK_EQ(n, 0);
}

TEST(AsyncSafeTraceMultiset_reset_clears_all) {
  AsyncSafeTraceMultiset m;
  CallFrame frames[] = {F(1, 0x100)};
  CallTrace trace = {1, frames};
  CHECK(m.Add(&trace));
  m.Reset();

  CallFrame out[kMaxFramesToCapture];
  int64_t count = 0;
  int found = 0;
  for (int loc = 0; loc < m.MaxEntries(); loc++) {
    int n = m.Extract(loc, kMaxFramesToCapture, out, &count);
    if (n > 0) found++;
  }
  CHECK_EQ(found, 0);
}

// --------------------------------------------------------------- TraceMultiset

TEST(TraceMultiset_aggregates_repeats) {
  TraceMultiset m;
  CallFrame frames[] = {F(1, 0x100)};
  m.Add(1, frames, 5);
  m.Add(1, frames, 3);    // same trace → count merges
  int sum = 0;
  int unique = 0;
  for (auto &entry : m) {
    sum += static_cast<int>(entry.second);
    unique++;
  }
  CHECK_EQ(unique, 1);
  CHECK_EQ(sum, 8);
}

TEST(TraceMultiset_keeps_distinct_traces_separate) {
  TraceMultiset m;
  CallFrame f1[] = {F(1, 0x100)};
  CallFrame f2[] = {F(2, 0x200)};
  m.Add(1, f1, 5);
  m.Add(1, f2, 7);
  int unique = 0;
  int sum = 0;
  for (auto &entry : m) {
    unique++;
    sum += static_cast<int>(entry.second);
  }
  CHECK_EQ(unique, 2);
  CHECK_EQ(sum, 12);
}

TEST(TraceMultiset_clear_resets) {
  TraceMultiset m;
  CallFrame frames[] = {F(1, 0x100)};
  m.Add(1, frames, 5);
  m.Clear();
  int unique = 0;
  for (auto &entry : m) {
    (void)entry;
    unique++;
  }
  CHECK_EQ(unique, 0);
}

// --------------------------------------------------------------- HarvestSamples

TEST(HarvestSamples_moves_traces_from_async_to_dense) {
  AsyncSafeTraceMultiset from;
  TraceMultiset to;

  CallFrame f1[] = {F(1, 0x100)};
  CallFrame f2[] = {F(2, 0x200)};
  CallTrace t1 = {1, f1};
  CallTrace t2 = {1, f2};
  CHECK(from.Add(&t1));
  CHECK(from.Add(&t2));
  CHECK(from.Add(&t1));

  // HarvestSamples returns the number of DISTINCT non-empty slots it
  // moved, not the sum of their tick counts. We added t1 twice + t2
  // once = 2 distinct slots, total ticks 3.
  int harvested = HarvestSamples(&from, &to);
  CHECK_EQ(harvested, 2);

  int unique = 0;
  int64_t sum = 0;
  for (auto &entry : to) {
    unique++;
    sum += entry.second;
  }
  CHECK_EQ(unique, 2);
  CHECK_EQ(sum, 3);
}
