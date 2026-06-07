# quarkusio/quarkus #44473 — Allow Hibernate ORM and Hibernate Reactive to be used in the same application

**[View PR on GitHub](https://github.com/quarkusio/quarkus/pull/44473)**

| | |
|---|---|
| **Author** | @lucamolteni |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @yrodiere
> users really shouldn't be using the `EntityManagerFactory` for Hibernate Reactive (the annotation has no use except internally).

### @yrodiere
> This is just for the `EntityManagerFactory` bean, right? So the problem would go away if the `EntityManagerFactory` for Hibernate Reactive was not a CDI bean?

### @FroMage
> I've no idea how to support this in Panache, though 😱

### @michalvavrik
> (Questioned whether the javadoc should say "normally enabled" rather than "normally disabled" regarding blocking components when no JDBC datasource exists.)

### @yrodiere
> Well I must say I didn't expect this to be doable with so few changes... impressive indeed.

> Note: A couple of the inline review-thread items above were lightly paraphrased where the public conversation HTML did not expose the full verbatim prose; commenter usernames and the substance are preserved, and directly-quoted items are marked verbatim.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
