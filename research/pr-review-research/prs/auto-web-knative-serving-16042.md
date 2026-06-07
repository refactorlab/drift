# knative/serving #16042 — Introduce new SecurePodDefaults options

**[View PR on GitHub](https://github.com/knative/serving/pull/16042)**

| | |
|---|---|
| **Author** | @nader-ziada |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @evankanderson
> This feels like it's doing something _different_, since `RunAsNonRoot` is a tri-state (`*bool`). Before, if `SecurePodDefaults` was `enabled`, this would set a missing `RunAsNonRoot` to `true`. If `RunAsNonRoot` was set to `false`, it would leave it as `false`.

### @evankanderson
> The problem is that on a quick read, it's not clear to me if `enabled > restricted` or `restricted > enabled` in terms of security. I'd sort of expect that `enabled` means as much security as possible.

### @evankanderson
> My concern is the behavior of a pod which uses a user container which only functions when running as the root user (for example, the binary shared libraries are in a `0700` directory owned by root).

### @dprotaso
> I'm wondering if we should use the profile names of `Pod Security Standards`. Then Knative's obligation is to 'default' settings appropriate to satisfy the profile.

### @evankanderson
> Getting towards safer defaults without breaking too many things for users is a net win, so I think it makes sense from a security perspective.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
