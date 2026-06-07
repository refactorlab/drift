# BabylonJS/Babylon.js #17035 — NavigationPluginV2 addon

**[View PR on GitHub](https://github.com/BabylonJS/Babylon.js/pull/17035)**

| | |
|---|---|
| **Author** | @RolandCsibrei |
| **Status** | Merged (by deltakosh) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @CedricGuillemet
> However now I've discovered that if you set `walkableSlopeAngle` to `0` it silently fails to generate the nav mesh if `tileSize` is not defined. If `tileSize` is defined it throws an error...

(CedricGuillemet additionally noted that changing the value to `0.1` resolves the problem for both solo and tiled nav meshes, and that obstacles require `maxObstacles` to be set alongside `tileSize` for proper tile generation.)

### @ryantrem
> I think we're all good!

### @RolandCsibrei
> @ryantrem I requested re-review by mistake, sorry.

---
*Note: This PR's discussion was largely bot notifications (bjsplat), author explanations, and approvals from CedricGuillemet and ryantrem without extended written rationale. The substantive technical thread is captured above.*

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
