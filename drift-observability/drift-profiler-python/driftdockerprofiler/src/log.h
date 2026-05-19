

#ifndef GOOGLECLOUDPROFILER_SRC_LOG_H_
#define GOOGLECLOUDPROFILER_SRC_LOG_H_

// Logs the error message using Python logging.error. It accepts arguments
// like printf: format specifiers in the given fmt are replaced by the
// corresponding additional arguments.
void LogError(const char *fmt, ...);

// Logs the warning message using Python logging.warning. It accepts arguments
// like printf: format specifiers in the given fmt are replaced by the
// corresponding additional arguments.
void LogWarning(const char *fmt, ...);

// Logs the info message using Python logging.info. It accepts arguments
// like printf: format specifiers in the given fmt are replaced by the
// corresponding additional arguments.
void LogInfo(const char *fmt, ...);

// Logs the debug message using Python logging.debug. It accepts arguments
// like printf: format specifiers in the given fmt are replaced by the
// corresponding additional arguments.
void LogDebug(const char *fmt, ...);

#endif  // GOOGLECLOUDPROFILER_SRC_LOG_H_
