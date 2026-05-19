// C++ test runner. Iterates the registered test vector (populated at
// static-init time by TEST() macros) and prints a pass/fail summary.
// Exit code is 0 iff every test passed.

#include <cstdio>

#include "check.h"

int main(int /*argc*/, char ** /*argv*/) {
  auto &tests = all_tests();
  std::printf("Running %zu C++ test case(s)\n", tests.size());
  std::printf("==============================================\n");

  int passed = 0;
  int failed_cases = 0;
  int total_failures = 0;
  for (auto &t : tests) {
    int case_failures = 0;
    t.fn(&case_failures);
    if (case_failures == 0) {
      std::printf("  PASS  %s\n", t.name);
      passed++;
    } else {
      std::printf("  FAIL  %s  (%d assertion failure(s))\n",
                  t.name, case_failures);
      failed_cases++;
      total_failures += case_failures;
    }
  }
  std::printf("==============================================\n");
  std::printf("Cases: %d passed, %d failed (of %zu total)\n",
              passed, failed_cases, tests.size());
  if (total_failures > 0) {
    std::printf("Assertion failures: %d\n", total_failures);
  }
  return failed_cases == 0 ? 0 : 1;
}
