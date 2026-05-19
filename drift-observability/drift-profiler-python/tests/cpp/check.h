// Tiny zero-dependency C++ test harness.
//
// Each test file declares cases with TEST(name) { ... } and asserts with
// CHECK(cond), CHECK_EQ(a, b), or CHECK_NE(a, b). At static-init time the
// macros register the case with `all_tests()`; main.cc iterates that
// vector and runs each case, printing PASS/FAIL.
//
// Why not gtest / catch2: those are large vendored deps. We test only a
// handful of internal helpers — the test infra should be the smallest
// reliable thing.

#ifndef DRIFTDOCKERPROFILER_TESTS_CPP_CHECK_H_
#define DRIFTDOCKERPROFILER_TESTS_CPP_CHECK_H_

#include <cstdio>
#include <cstdlib>
#include <vector>

struct TestCase {
  const char *name;
  void (*fn)(int *failed);
};

// One vector shared across translation units. The function-local static
// pattern works because static-initialization order is per-TU but each
// TU's Reg_* constructor only depends on this function (not on another
// TU's global), so the vector is always initialised before the first
// push_back hits it.
inline std::vector<TestCase> &all_tests() {
  static std::vector<TestCase> v;
  return v;
}

// Test registration. Use as `TEST(name) { ... }`.
#define TEST(name)                                                       \
  static void test_##name(int *_drift_failed);                           \
  namespace {                                                            \
    struct Reg_##name {                                                  \
      Reg_##name() {                                                     \
        all_tests().push_back({#name, &test_##name});                    \
      }                                                                  \
    } reg_##name##_instance;                                             \
  }                                                                      \
  static void test_##name(int *_drift_failed)

// `*_drift_failed` is the per-case counter passed by main.cc. We bump it
// here so the runner can tell pass from fail per case. We don't abort
// the case on first failure — multiple CHECKs per test are useful, and
// the cost of a few stale assertions is worth the extra signal.
#define CHECK(cond)                                                      \
  do {                                                                   \
    if (!(cond)) {                                                       \
      std::fprintf(stderr,                                               \
                   "    FAIL %s:%d  CHECK(%s)\n",                        \
                   __FILE__, __LINE__, #cond);                           \
      (*_drift_failed)++;                                                \
    }                                                                    \
  } while (0)

// CHECK_EQ uses int64_t coercion so it works for int / long / time_t /
// pointer-derived-int — adequate for our use; we don't compare strings.
#define CHECK_EQ(a, b)                                                   \
  do {                                                                   \
    auto _drift_a = (a);                                                 \
    auto _drift_b = (b);                                                 \
    if (!(_drift_a == _drift_b)) {                                       \
      std::fprintf(stderr,                                               \
                   "    FAIL %s:%d  CHECK_EQ(%s == %s)  "                \
                   "(left=%lld right=%lld)\n",                           \
                   __FILE__, __LINE__, #a, #b,                           \
                   (long long)_drift_a, (long long)_drift_b);            \
      (*_drift_failed)++;                                                \
    }                                                                    \
  } while (0)

#define CHECK_NE(a, b)                                                   \
  do {                                                                   \
    auto _drift_a = (a);                                                 \
    auto _drift_b = (b);                                                 \
    if (!(_drift_a != _drift_b)) {                                       \
      std::fprintf(stderr,                                               \
                   "    FAIL %s:%d  CHECK_NE(%s != %s)  "                \
                   "(both=%lld)\n",                                      \
                   __FILE__, __LINE__, #a, #b,                           \
                   (long long)_drift_a);                                 \
      (*_drift_failed)++;                                                \
    }                                                                    \
  } while (0)

#endif  // DRIFTDOCKERPROFILER_TESTS_CPP_CHECK_H_
