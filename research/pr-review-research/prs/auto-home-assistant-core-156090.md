# home-assistant/core #156090 — Victron GX communication center integration

**[View PR on GitHub](https://github.com/home-assistant/core/pull/156090)**

| | |
|---|---|
| **Author** | @tomer-w |
| **Status** | ✅ merged |
| **Opened** | 2025-11-08 |
| **Repo importance** | ★87,540 · 37,612 forks · score 242,987 |
| **Diff** | +3488 / −1 across 22 files |
| **Engagement** | 59 conversation · 683 inline review comments |

## Top review comments (ranked by reactions)

### @NoRi2909 — 1 reactions  
`👍 1`  ·  [link](https://github.com/home-assistant/core/pull/156090#issuecomment-3637084337)

> @tomer-w I'm very happy to see the progress you make in bringing this integration into Home Assistant Core as I have a live Victron system here myself. 😃 
> 
> As one of the two main contributors to the German translation I will try to help you get the English strings at 100% accuracy so we can produce a comparably good translation here, too.

### @tomer-w — 1 reactions  
`👍 1`  ·  [link](https://github.com/home-assistant/core/pull/156090#issuecomment-3657043823)

> @NoRi2909, I just pushed a commit with the changes you requested. thanks for your feedback.

### @tomer-w — 0 reactions  
`—`  ·  [link](https://github.com/home-assistant/core/pull/156090#issuecomment-3507546475)

> > [When adding new integrations, limit included platforms to a single platform. Please reduce this PR to a single platform](https://developers.home-assistant.io/docs/review-process/#home-assistant-core)
> 
> There are really few different domains in this integration, but it will not be useful if I add only one. This PR is full merge of the already working for months [custom integration](https://github.com/tomer-w/ha-victron-mqtt). Also, the code in the integration itself is minimal as all the complexities are in the Victron client library. This is just a thin wrapper. Hopefully, you will be able to approve it as is.

### @tomer-w — 0 reactions  
`—`  ·  [link](https://github.com/home-assistant/core/pull/156090#issuecomment-3511745325)

> Hey @joostlek , thanks for taking a look on this!
> With regards to your questions:
> 1. The code diff between one platform or all of them is quite minimal as all the heavy lifting happens in the [victron-mqtt](https://github.com/tomer-w/victron_mqtt) package. If I keep only ```SENSOR``` it will have really limited functionality. Let me know what you think, Can I later submit it the next day? Do I need to wait for the next HA version? Just FYI, I currently have 344 different entities extracted out of Victron and more are added on a weekly basis. What is nice that this does not require any code change in the HA integration side, just the package it is using.
> 2. The basic configuration is to connect to remote MQTT broker which is running on the Victron Cerbo GX device itself. Although I have some users which deployed a centralized MQTT server which fetch data from multiple Cerbo GX devices and point the integration to that MQTT server.
> 3. The operation mode has 3 options:
>   READ_ONLY - This exposes all 344 entities as ```SENSOR``` and ```BINARY_SENSOR```.
>   FULL - Entities which are editable by Victron will be editable. This add some risk as just sliding something in the UI can create some real impact on connected system / turn them off / change cost / income generated, etc.
>   EXPERIMENTAL - add latest entities which still didnt get enough feedback yet. I usually mark entities as experimental if they are using some new code base and not just different MQTT topic.
>  
> Will be glad to do whatever is needed to get it in.

### @joostlek — 0 reactions  
`—`  ·  [link](https://github.com/home-assistant/core/pull/156090#issuecomment-3511841110)

> 1. There's one thing we generally see with these approaches and that is that we can't properly contextualize entities. As in, generally we want to give them a translated name. I have to admit, I haven't looked into the code yet, but what other benefit does having it in the library have over having it in the codebase? To answer the other question, yes we still want to have one platform at a time. This way the review burden is just way lower and that way we can focus on the internals first.
> 2. Sounds great. However, we don't really want to support custom setups like that. As in, if it works, sure I guess, but we should not maintain code that does not directly integrate with the device IMO.
> 3. I think if we are adding the sensor entity first, this wouldn't be an issue right now. In generally you get every entity with a core integration, however, if we can make a good argument against something, we can always discuss that. For the experimental one, I think experimental is an interesting term as it isn't clear what this would mean for the end user. As in, will this break at any time? Will it get removed? I think the tinkering phase shouldn't be in production code (as in, if you're confident that it will work, let's merge features, but if you are still testing with users (as you don't have 10 inverters of course) we don't want to merge that directly into core and have people gamble with their setups the next release. We have scripts and ways to help this process, but let's not include this for now.
> 
> In any case, feel free to reach out on Discord :)

### @tomer-w — 0 reactions  
`—`  ·  [link](https://github.com/home-assistant/core/pull/156090#issuecomment-3513265847)

> @joostlek,, thanks for the feedback. Here is what I think.
> 1. You are right that translated names is the only big issue with having the entities defined outside of the integration code. I spent lot of time finding the right solution. What I came with is GitHub [workflow](https://github.com/tomer-w/ha-victron-mqtt/blob/main/.github/workflows/update_victron_mqtt.yml) which runs nightly, it takes the latest ```victron_mqtt``` package, if it is newer from what is already used in the integration, it will open a PR against the integration repo which update the manifest to latest version and fetch all the entities and their English name and update the ```strings.json```. This way I can take new versions with one click and zero manual intervention. I will do the same against the HA core integration when I get it approved. You should take a quick look on the code, you will see it is really empty. There is almost nothing on the HA side.
> 2. I agree that customers who will try to pull data from a gateway mqtt server is not common, but I had to do really minor tweaks to support it. There are 2 relevant options in the config flow to support that. one is the mqtt prefix and the 2nd is simple naming of entities. With simple naming I remove the Victron deployment ID from the entities ID. This makes the entities much more readable but will not work well if you have multiple Victron attached. Of course, the default is simple naming.
> 3. I agree I should not expose the experimental feature in the built in integration. I can keep it only in the HACS variant. With regards to the read-only, If you … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
