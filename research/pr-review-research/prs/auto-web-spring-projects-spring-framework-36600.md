# spring-projects/spring-framework #36600 — Document that `spring.profiles.active` is ignored by `@ActiveProfiles`

**[View PR on GitHub](https://github.com/spring-projects/spring-framework/pull/36600)**

| | |
|---|---|
| **Author** | @Mohak-Nagaraju |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @sbrannen
> I've modified the title of this PR to reflect that it's the default behavior of `@ActiveProfiles` which does not honor that Spring property

### @sbrannen
> (Multiple requests to narrow the wording so it is specific to when `@ActiveProfiles` is declared, rather than making broader claims about the Test Context Framework's behavior.)

### @sbrannen
> (Guidance to broaden the 'system property' language to also "cover environment variables," recognizing there are multiple configuration mechanisms beyond just system properties.)

### @sbrannen
> (Requested an example showing how to implement a `SystemPropertyOverrideActiveProfilesResolver`, demonstrating a workaround pattern for users needing system-property override capability.)

> Note: Some of the inline review-thread prose on this PR was not fully retrievable from the public conversation HTML; the reviewer (@sbrannen) and the substance of each request are captured above, with the first item quoted verbatim.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
