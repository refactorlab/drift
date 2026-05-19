
"""Docker Profiler Python agent packaging script.

Forked and stripped of all Google Cloud transmission. The agent now
writes JSONL events to a local file (default `/tmp/drift/events.jsonl`)
dependencies:

  - requests                  (GCE metadata server probes)

The C++ extension (`driftdockerprofiler._profiler`, the SIGPROF-based
CPU sampler) is retained verbatim: it's pure POSIX/CPython API, no
Google dependency.
"""


import glob
import re
import sys
from setuptools import Extension
from setuptools import find_packages
from setuptools import setup

# No external runtime dependencies — the agent only uses Python stdlib.
install_requires: list = []

ext_module = [
    Extension(
        'driftdockerprofiler._profiler',
        sources=glob.glob('driftdockerprofiler/src/*.cc'),
        include_dirs=['driftdockerprofiler/src'],
        language='c++',
        extra_compile_args=['-std=c++11'],
        extra_link_args=[
            '-std=c++11',
            '-static-libstdc++',
            # While libgcc_s.so.1 is pretty much always installed by default
            # for non-Alpine linux, it is not installed by default in Alpine.
            # So, to support Alpine, we will always statically link "libgcc"
            # package. We could alternatively require users to install the
            # "libgcc" package, but the static linkage seems less
            # invasive.
            '-static-libgcc'
        ])
]

if not (sys.platform.startswith('linux') or sys.platform.startswith('darwin')):
  print(
      sys.platform, 'is not a supported operating system.\n'
      'Profiler Python agent modules will be installed but will not '
      'be functional. Refer to the documentation for a list of '
      'supported operating systems.\n')
  ext_module = []

if sys.platform.startswith('darwin'):
  print(
      'Profiler Python agent has limited support for ', sys.platform, '. '
      'Wall profiler is available with supported Python versions. '
      'CPU profiler is not available. '
      'Refer to the documentation for a list of supported operating '
      'systems and Python versions.\n')
  # Drop the C++ extension on macOS — clang doesn't accept
  # `-static-libstdc++` / `-static-libgcc`, and SIGPROF behavior on
  # Darwin is too limited for the CPU profiler to work reliably. macOS
  # users still get the pure-Python wall profiler.
  ext_module = []


def get_version():
  """Read the version from __version__.py."""

  with open('driftdockerprofiler/__version__.py') as fp:
    # Do not handle exceptions from open() so setup will fail when it cannot
    # open the file
    line = fp.read()
    version = re.search(r"^__version__ = '([0-9]+\.[0-9]+(\.[0-9]+)?-?.*)'",
                        line, re.M)
    if version:
      return version.group(1)

  raise RuntimeError(
      'Cannot determine version from driftdockerprofiler/__init__.py.')


setup(
    # PyPI publish name. Importers still `import driftdockerprofiler`,
    # but on disk and on PyPI the distribution is `driftdockerprofiler`.
    name='driftdockerprofiler',
    description='Local-file wall + CPU stack-sampling Python profiler '
                '(forked from Google Cloud Profiler, no GCP transmission)',
    long_description=open('README.md').read(),
    long_description_content_type='text/markdown',
    url='https://github.com/GoogleCloudPlatform/cloud-profiler-python',
    author='ilya shusterman',
    author_email='shusterilyaman@gmail.com',
    version=get_version(),
    install_requires=install_requires,
    setup_requires=['wheel'],
    packages=find_packages(exclude=('tests', 'tests.*')),
    # Ship the JSON Schema files alongside the Python modules. Without
    # this, `pip install` strips them from the wheel and runtime
    # callers of `driftdockerprofiler.event_schema()` see FileNotFoundError.
    package_data={
        'driftdockerprofiler.schemas': ['*.json'],
    },
    include_package_data=True,
    ext_modules=ext_module,
    license='Apache License, Version 2.0',
    keywords='profiler python wall cpu stack-sampling',
    classifiers=[
        'Development Status :: 5 - Production/Stable',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: Apache Software License',
        'Programming Language :: Python :: 3.7',
        'Programming Language :: Python :: 3.8',
        'Programming Language :: Python :: 3.9',
        'Programming Language :: Python :: 3.10',
        'Programming Language :: Python :: 3.11',
        'Programming Language :: Python :: 3.12',
        'Programming Language :: Python :: 3.13',
    ],
)
