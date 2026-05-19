

#include <Python.h>

#include "clock.h"
#include "profiler.h"

namespace {
PyObject* ProfileCPU(PyObject* self, PyObject* args) {
  uint64_t duration_nanos = 0;
  uint64_t period_msec = 0;
  if (!PyArg_ParseTuple(args, "LL", &duration_nanos, &period_msec)) {
    return nullptr;
  }

  CPUProfiler p(duration_nanos, period_msec * kNanosPerMilli);
  return p.Collect();
}

PyMethodDef ProfilerMethods[] = {
    {"profile_cpu", ProfileCPU, METH_VARARGS, "A function for CPU profiling."},
    {nullptr, nullptr, 0, nullptr} /* Sentinel */
};

struct PyModuleDef moduledef = {
    PyModuleDef_HEAD_INIT, "_profiler",           /* name of module */
    "Google Cloud Profiler C++ extension module", /* module documentation */
    -1, ProfilerMethods};
}  // namespace

PyMODINIT_FUNC PyInit__profiler(void) { return PyModule_Create(&moduledef); }
