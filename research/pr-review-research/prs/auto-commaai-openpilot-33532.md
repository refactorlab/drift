# commaai/openpilot #33532 — Replace ThneedModel with TinygradModel

**[View PR on GitHub](https://github.com/commaai/openpilot/pull/33532)**

| | |
|---|---|
| **Author** | @mitchellgoffpc |
| **Status** | ✅ merged |
| **Opened** | 2024-09-10 |
| **Repo importance** | ★61,282 · 10,955 forks · score 110,097 |
| **Diff** | +151 / −1021 across 25 files |
| **Engagement** | 32 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @adeebshihadeh — 0 reactions  
`—`  ·  [link](https://github.com/commaai/openpilot/pull/33532#issuecomment-2342011018)

> Started a #current-projects for this in Discord: https://discord.com/channels/469524606043160576/1283171724719951904

### @commaci-public — 0 reactions  
`—`  ·  [link](https://github.com/commaai/openpilot/pull/33532#issuecomment-2422952675)

> ref for commit 1a2414d3175b8469546b640e4e630e5c34cae106: https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/2f4452b03ccb98f0|2022-12-03--13-45-30_model_tici_1a2414d3175b8469546b640e4e630e5c34cae106.bz2<details open><summary>Model Replay Differences</summary><table><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/velocity.x.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/desiredCurvature.png"></td></tr><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/leadsV3.x.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/laneLines.y.png"></td></tr><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/gasPressProbs.png"></td></table></details><details ><summary>All Model Replay Plots</summary><table><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/velocity.x.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/desiredCurvature.png"></td></tr><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/leadsV3.x.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/laneLines.y.png"> … *[truncated]*

### @commaci-public — 0 reactions  
`—`  ·  [link](https://github.com/commaai/openpilot/pull/33532#issuecomment-2422959712)

> ref for commit 0f2cf7d57d10ea53443b297da01401e57f40892a: https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/2f4452b03ccb98f0|2022-12-03--13-45-30_model_tici_0f2cf7d57d10ea53443b297da01401e57f40892a.bz2<details open><summary>Model Replay Differences</summary><table><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/velocity.x.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/desiredCurvature.png"></td></tr><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/leadsV3.x.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/laneLines.y.png"></td></tr><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/gasPressProbs.png"></td></table></details><details ><summary>All Model Replay Plots</summary><table><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/velocity.x.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/desiredCurvature.png"></td></tr><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/leadsV3.x.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/laneLines.y.png"> … *[truncated]*

### @commaci-public — 0 reactions  
`—`  ·  [link](https://github.com/commaai/openpilot/pull/33532#issuecomment-2422963753)

> ref for commit 3b49daff7f1ed5e30b4d193db0bd613a0e4725d2: https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/2f4452b03ccb98f0|2022-12-03--13-45-30_model_tici_3b49daff7f1ed5e30b4d193db0bd613a0e4725d2.bz2<details open><summary>Model Replay Differences</summary><table><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/velocity.x.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/desiredCurvature.png"></td></tr><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/leadsV3.x.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/laneLines.y.png"></td></tr><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/gasPressProbs.png"></td></table></details><details ><summary>All Model Replay Plots</summary><table><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/velocity.x.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/desiredCurvature.png"></td></tr><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/leadsV3.x.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/laneLines.y.png"> … *[truncated]*

### @commaci-public — 0 reactions  
`—`  ·  [link](https://github.com/commaai/openpilot/pull/33532#issuecomment-2422997180)

> ref for commit a3254f20dd989561b8d3cb83c25c41a1a74dffc5: https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/2f4452b03ccb98f0|2022-12-03--13-45-30_model_tici_a3254f20dd989561b8d3cb83c25c41a1a74dffc5.bz2<details open><summary>Model Replay Differences</summary><table><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/velocity.x.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/desiredCurvature.png"></td></tr><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/leadsV3.x.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/laneLines.y.png"></td></tr><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/gasPressProbs.png"></td></table></details><details ><summary>All Model Replay Plots</summary><table><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/velocity.x.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/desiredCurvature.png"></td></tr><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/leadsV3.x.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/laneLines.y.png"> … *[truncated]*

### @commaci-public — 0 reactions  
`—`  ·  [link](https://github.com/commaai/openpilot/pull/33532#issuecomment-2423023825)

> ref for commit 877b8b3ea0d6a7b786558545dd0178d7541415e9: https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/2f4452b03ccb98f0|2022-12-03--13-45-30_model_tici_877b8b3ea0d6a7b786558545dd0178d7541415e9.bz2<details open><summary>Model Replay Differences</summary><table><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/velocity.x.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/desiredCurvature.png"></td></tr><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/leadsV3.x.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/laneLines.y.png"></td></tr><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/gasPressProbs.png"></td></table></details><details ><summary>All Model Replay Plots</summary><table><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/velocity.x.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/desiredCurvature.png"></td></tr><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/leadsV3.x.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_tinygrad-runner/laneLines.y.png"> … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
