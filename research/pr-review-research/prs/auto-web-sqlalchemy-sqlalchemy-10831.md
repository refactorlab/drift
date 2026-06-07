# sqlalchemy/sqlalchemy #10831 — Documenting multiprocessing and events

**[View PR on GitHub](https://github.com/sqlalchemy/sqlalchemy/pull/10831)**

| | |
|---|---|
| **Author** | @jamesbraza |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @zzzeek
> I disagree with the wording 'in a limited manner', from my perspective it does not make any sense for events to 'support multiprocessing', since event hooks pass live Python objects around.

### @zzzeek
> SQLAlchemy's event hooks are implemented as Python data structures associated with a particular pair of Python functions and objects. Event propagation itself is implemented as Python function calls.

### @zzzeek
> Event hooks registered in a parent process will be present in new child processes that are forked from that parent **after** the hooks have been registered...Child processes that already exist **before** the hooks are registered will **not** receive those new event hooks.

### @zzzeek
> For the events themselves, these are Python function calls, which do not have any ability to propagate between processes. SQLAlchemy's event system does not implement any inter-process communication.

### @jamesbraza
> Any chance I can bug for a re-review here? Just looking to keep this moving forward

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
