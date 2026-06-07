# home-assistant/core #148948 — Add WiiM media player integration

**[View PR on GitHub](https://github.com/home-assistant/core/pull/148948)**

| | |
|---|---|
| **Author** | @Linkplay2020 |
| **Status** | ✅ merged |
| **Opened** | 2025-07-17 |
| **Repo importance** | ★87,540 · 37,612 forks · score 242,987 |
| **Diff** | +2505 / −0 across 20 files |
| **Engagement** | 36 conversation · 398 inline review comments |

## Top review comments (ranked by reactions)

### @mjcumming — 4 reactions  
`👍 2 · ❤️ 2`  ·  [link](https://github.com/home-assistant/core/pull/148948#issuecomment-3963815309)

> Hi All,  I think we’re duplicating work and fragmenting the user experience here.
> 
> I maintain a fully functional integration under the “WiiM” banner that supports a broad range of LinkPlay-based devices (not just WiiM-branded hardware). The big benefit is that we can have a single integration that covers the entire LinkPlay ecosystem, rather than multiple overlapping integrations that users have to guess between.
> 
> Before a separate core WiiM integration goes much further, can we discuss whether the better path is to unify by either improving or extending the existing core linkplay integration, or upstreaming a more comprehensive LinkPlay/WiiM codebase so there’s a single, clear, robust solution?
> 
> I’m happy to share the repo, the supported-device matrix, and the edge cases we’ve already handled (grouping/multiroom, state reliability, reconnect/IP churn, etc.), and help test on more hardware.  https://github.com/mjcumming/wiim and https://github.com/mjcumming/pywiim

### @mjcumming — 4 reactions  
`👍 3 · ❤️ 1`  ·  [link](https://github.com/home-assistant/core/pull/148948#issuecomment-4076763818)

> For visibility, there is already an existing Home Assistant WiiM integration here:
> 
> https://github.com/mjcumming/wiim
> 
> It is already in active use, with about 700 installs, and the repo currently has 88 GitHub stars.
> 
> That integration already covers a fairly broad set of WiiM/LinkPlay-specific behavior, including:
> - multiroom/group handling
> - EQ support, including dynamic preset handling
> - firmware update support
> - source and output mode handling
> - TTS / announce behavior
> - device- and firmware-specific capability detection and compatibility fixes
> 
> I think it is important that reviewers and maintainers have visibility into the fact that there is already a fairly mature, actively maintained implementation with a real user base, so any decision about a separate core implementation can be made with that context in mind.

### @Linkplay2020 — 3 reactions  
`❤️ 3`  ·  [link](https://github.com/home-assistant/core/pull/148948#issuecomment-3094988812)

> > Why is this a different integration from `linkplay`?
> 
> This integration is officially developed by our company, Linkplay. The previous "linkplay" integration was created by a third party on our behalf. Many of our customers encountered issues while using that third-party integration, which is why we officially released and are now actively maintaining the "wiim" integration to better support our users.

### @balloob-travel — 3 reactions  
`👍 2 · ❤️ 1`  ·  [link](https://github.com/home-assistant/core/pull/148948#issuecomment-4079069278)

> @mjcumming we are aware and thanks for your work on it. 
> 
> It is always better to have a built-in integration in Home Assistant over a custom one that lives in HACS. Built-in allows Home Assistant to automatically discover the integration and offer set-up to the user. Although today it will not be as good as the custom one, we hope that over time we can match all the functions.
> 
> New integrations always start with the bare minimum, to make it easier to review (as you can see from this PR, even minimal functionality is a lot of review work!).
> 
> We don't allow contributors to contribute work from other people, which is why this integration has been built from scratch. I agree that time could have probably been saved if the efforts were combined. It would be great if we can collaborate on the built-in integration in the future.

### @Hedda — 2 reactions  
`👍 1 · 👎 1`  ·  [link](https://github.com/home-assistant/core/pull/148948#issuecomment-3772364012)

> > The existing Linkplay integration in Home Assistant was developed by a third-party developer based on our public HTTP API, and it can control any device that uses the Linkplay solution.
> > 
> > We are the official Linkplay team. The new WiiM integration is a new implementation based on our own UPnP protocol. In principle, devices that use the Linkplay solution can still work with the WiiM integration, but for non-WiiM devices, not all features will necessarily be supported.
> > 
> > In general, we welcome and support contributions from third-party developers. As for whether the original Linkplay integration should be replaced, that decision is probably up to the Home Assistant community.
> > 
> > Music Assistant is another project developed by a third party based on our library. All of our device control APIs are publicly available on our website, and any developer is free to use them.
> 
> @Linkplay2020 why not coolaborate with @Velleman on rewritting the existing component or ask him if you can take over ownership of it? Anyway, it would normally not be a good idea to have two integrations inside Home Assistant's core that can do the same thing.
> 
> * https://www.home-assistant.io/integrations/linkplay/
> 
>   * https://github.com/home-assistant/core/tree/dev/homeassistant/components/linkplay
> 
> Regardless, I think it will be confusing for end-users to have one official and one unofficial integration unless they both are clearly marked and such and descripion + cross-links exist to make new and existing users aware if there are two compatible integrations.
> 
> To clearify, I don't think is quite … *[truncated]*

### @davidanthoff — 2 reactions  
`👍 1 · 🚀 1`  ·  [link](https://github.com/home-assistant/core/pull/148948#issuecomment-3888539324)

> Yes, I currently have two PRs open against music-assistant, one based on the `wiim` package and one based on `pywiim`. I expect only one will be merged eventually, I'm just playing around with both options at the moment.
> 
> Right now I am very strongly leaning towards going with the `pywiim` based PR. The `pywiim` package seems very high quality, very pythonic, exactly the right level of abstraction and it supports way more devices than the `wiim` package, AFAIK.
> 
> There already exists a HA integration based on `pywiim` (https://github.com/mjcumming/wiim). I guess one major question here is whether it might make sense that the LinkPlay folks join forces on that excellent piece of community created software and contribute to that effort, and then that could eventually become the "official" Wiim/Linkplay integration here in HA?


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
