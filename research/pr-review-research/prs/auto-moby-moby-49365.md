# moby/moby #49365 — Improve performance of daemon.Containers() 

**[View PR on GitHub](https://github.com/moby/moby/pull/49365)**

| | |
|---|---|
| **Author** | @ctalledo |
| **Status** | ✅ merged |
| **Opened** | 2025-01-29 |
| **Repo importance** | ★71,621 · 18,962 forks · score 152,468 |
| **Diff** | +269 / −112 across 5 files |
| **Engagement** | 21 conversation · 78 inline review comments |

## Top review comments (ranked by reactions)

### @ctalledo — 0 reactions  
`—`  ·  [link](https://github.com/moby/moby/pull/49365#issuecomment-2635658421)

> @thaJeztah: I noticed the following integration test fails with this PR:
> 
> ```
> === Failed
> === FAIL: amd64.integration-cli TestDockerCLIPsSuite/TestPsListContainersBase (1.10s)
>     docker_cli_ps_test.go:56: assertion failed: false (bool) != true (true bool): ALL: Container list is not in the correct order: 
> ```
> 
> It seems it's expecting `docker ps` to list containers in a certain order, which this PR doesn't guarantee given that is runs concurrent threads to gather the container listing, so the order of the results is not guaranteed.
> 
> I don't believe `docker ps` has any ordering guarantees, so I am thinking the failing integration test is overly strict and needs changing. Am I correct?

### @thaJeztah — 0 reactions  
`—`  ·  [link](https://github.com/moby/moby/pull/49365#issuecomment-2636256234)

> > I don't believe docker ps has any ordering guarantees, so I am thinking the failing integration test is overly strict and needs changing. Am I correct?
> 
> Oh! Yes, order _does_ matter; and I :see_no_evil: was actually looking at that when I was reviewing, then forgot (for the tests, I was wondering why we only checked the length, and not a `DeepEqual`, which likely should work with no filters applied)
> 
> containers must be listed in descending order (last created container must appear first in the list). This order allows for various uses, and it's not unlikely that users depend on things like;
> 
> View the last X containers;
> 
> ```bash
> docker ps -a | head -n 3
> CONTAINER ID   IMAGE           COMMAND                  CREATED             STATUS                      PORTS     NAMES
> c1a80713617b   nginx:alpine    "/docker-entrypoint.…"   About an hour ago   Up About an hour            80/tcp    pensive_murdock
> c6de2c72b5ae   docker-dev      "hack/dind bash"         19 hours ago        Up 19 hours                           stoic_driscoll
> ```
> 
> Or getting the ID of the last container;
> 
> ```bash
> docker ps -q | head -n 1
> c1a80713617b
> ```
> 
> So the `filterByNameIDMatches` method is currently responsible for ordering, but the method is un-exported, and not documented, so doesn't clearly define that contract;
> https://github.com/moby/moby/blob/63ea5dc10e99e070a00c449e7fd78916a9fd125a/daemon/list.go#L169
> https://github.com/moby/moby/blob/63ea5dc10e99e070a00c449e7fd78916a9fd125a/daemon/list.go#L219-L221
> 
> :point_up: honestly, I think we should move that sorting out of the `filterByNameIDMatches` fun … *[truncated]*

### @thaJeztah — 0 reactions  
`—`  ·  [link](https://github.com/moby/moby/pull/49365#issuecomment-2636257433)

> Oh! LOL; I see @vvoland also reviewed (looks like my tab didn't refresh 😂)

### @ctalledo — 0 reactions  
`—`  ·  [link](https://github.com/moby/moby/pull/49365#issuecomment-2655350822)

> Thanks @thaJeztah  and @vvoland for the feedback regarding "ordering does matter" in the container list. 
> 
> I've re-worked the solution to ensure the ordering is kept in the container list result, along the lines of what @vvoland suggested.
> 
> I also added modified the unit and integration tests to verify that the ordering is as expected (i.e., newer containers first, older containers last).
> 
> Please take a look again, thanks!

### @vvoland — 0 reactions  
`—`  ·  [link](https://github.com/moby/moby/pull/49365#issuecomment-2656304773)

> Looks like `TestList` is still failing 🤔 
> 
> ```
> === RUN   TestList
>     list_test.go:34: assertion failed: expected [{96a4b02fb2a59c57c31c4aa066b57aef9c991d8d41a7e3875934afa9874b5af7 [/fervent_volhard] busybox sha256:19d689bc58fd64da6a46d46512ea965a12b6bfb5b030400e21bc0a04c4ff155e top %!s(int64=1739416183) [] %!s(int64=0) %!s(int64=0) map[] created Created {bridge map[]} %!s(*container.NetworkSettingsSummary=&{map[bridge:0x40000a3b20]}) []} {b9ef4de52a7503881972db145379faa46e31c7c5561e5e19acb833f699a78256 [/happy_payne] busybox sha256:19d689bc58fd64da6a46d46512ea965a12b6bfb5b030400e21bc0a04c4ff155e top %!s(int64=1739416183) [] %!s(int64=0) %!s(int64=0) map[] created Created {bridge map[]} %!s(*container.NetworkSettingsSummary=&{map[bridge:0x40000a3c00]}) []} {097eadaf6f8d2c2cecf24090605896ebac4dc0144459c3e840dbbbf7cd1d74f1 [/laughing_liskov] busybox sha256:19d689bc58fd64da6a46d46512ea965a12b6bfb5b030400e21bc0a04c4ff155e top %!s(int64=1739416183) [] %!s(int64=0) %!s(int64=0) map[] created Created {bridge map[]} %!s(*container.NetworkSettingsSummary=&{map[bridge:0x40000a3ce0]}) []} {43a219150b0da2b89bc19c01946f9b909d2c85758b04ea1555fa3c64a3050d3d [/blissful_turing] busybox sha256:19d689bc58fd64da6a46d46512ea965a12b6bfb5b030400e21bc0a04c4ff155e top %!s(int64=1739416183) [] %!s(int64=0) %!s(int64=0) map[] created Created {bridge map[]} %!s(*container.NetworkSettingsSummary=&{map[bridge:0x40000a3dc0]}) []} {091364ccad7541f8d0b0b3838297395059313928563d43a1cc5cab21d3f7ece2 [/vigorous_hopper] busybox sha256:19d689bc58fd64da6a46d46512ea965a12b6bfb5b030400e21bc0a04c4ff155e top %!s(int … *[truncated]*

### @thaJeztah — 0 reactions  
`—`  ·  [link](https://github.com/moby/moby/pull/49365#issuecomment-2656307487)

> The good news; the test is doing something; the bad news; it's failing. Wondering if it could be some rounding issue
> 
> ```
> === RUN   TestList
>     list_test.go:34: assertion failed: expected [{a7815a45260738ab7fb7d44622449e9041b99d7a13b9c079271a40ffef53c7aa [/dazzling_zhukovsky] busybox sha256:328dac05c07eb589d3a783c8bd2bc264f38dbcf1f71d00844804bd4c4aba3597 top %!s(int64=1739416332) [] %!s(int64=0) %!s(int64=0) map[] created Created {bridge map[]} %!s(*container.NetworkSettingsSummary=&{map[bridge:0xc00064c000]}) []} {59b9fe26516324eac75b168c4aecc69d98f8d997d98e0fcce0bf18c01c7a0f70 [/vigorous_volhard] busybox sha256:328dac05c07eb589d3a783c8bd2bc264f38dbcf1f71d00844804bd4c4aba3597 top %!s(int64=1739416332) [] %!s(int64=0) %!s(int64=0) map[] created Created {bridge map[]} %!s(*container.NetworkSettingsSummary=&{map[bridge:0xc00064c0e0]}) []} {986703c56f75e1bdbb0577e9e53fab3cc46de51fe358d0cd4faa73a4e89a50ca [/jovial_roentgen] busybox sha256:328dac05c07eb589d3a783c8bd2bc264f38dbcf1f71d00844804bd4c4aba3597 top %!s(int64=1739416332) [] %!s(int64=0) %!s(int64=0) map[] created Created {bridge map[]} %!s(*container.NetworkSettingsSummary=&{map[bridge:0xc00064c1c0]}) []} {23682cb1ba4366c8800b715cdf868f387e77212c65265cabab911d598f841971 [/musing_meitner] busybox sha256:328dac05c07eb589d3a783c8bd2bc264f38dbcf1f71d00844804bd4c4aba3597 top %!s(int64=1739416332) [] %!s(int64=0) %!s(int64=0) map[] created Created {bridge map[]} %!s(*container.NetworkSettingsSummary=&{map[bridge:0xc00064c2a0]}) []} {7e12d8e5b21fdb4ba1c029c82f3acabbe7e59702f1636f879bede82b6cb39901 [/tender_perlman] busybox sha … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
