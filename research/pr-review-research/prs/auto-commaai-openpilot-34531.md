# commaai/openpilot #34531 — Online lateral lag learning

**[View PR on GitHub](https://github.com/commaai/openpilot/pull/34531)**

| | |
|---|---|
| **Author** | @fredyshox |
| **Status** | ✅ merged |
| **Opened** | 2025-02-05 |
| **Repo importance** | ★61,282 · 10,955 forks · score 110,097 |
| **Diff** | +545 / −206 across 9 files |
| **Engagement** | 31 conversation · 4 inline review comments |

## Top review comments (ranked by reactions)

### @royjr — 1 reactions  
`👍 1`  ·  [link](https://github.com/commaai/openpilot/pull/34531#issuecomment-2746751013)

> Lmk if you'd like me to test anything out to help move this along.

### @commaci-public — 0 reactions  
`—`  ·  [link](https://github.com/commaai/openpilot/pull/34531#issuecomment-2708025842)

> ref for commit 11ffb3fb163f996ae29889e0ed8d22be9ca537ce: https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/8494c69d3c710e81|000001d4--2648a9a404_model_tici_11ffb3fb163f996ae29889e0ed8d22be9ca537ce.zst<details open><summary>Model Replay Differences</summary><table><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/velocity.x_11ffb3f.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/desiredCurvature_11ffb3f.png"></td></tr><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/leadsV3.x_11ffb3f.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/laneLines.y_11ffb3f.png"></td></tr><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/desireState.laneChangeLeft_11ffb3f.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/desireState.laneChangeRight_11ffb3f.png"></td></tr><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/gasPressProbs_11ffb3f.png"></td></table></details><details ><summary>All Model Replay Plots</summary><table><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/velocity.x_11ffb3f.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads … *[truncated]*

### @commaci-public — 0 reactions  
`—`  ·  [link](https://github.com/commaai/openpilot/pull/34531#issuecomment-2708076012)

> ref for commit ea5efb5b1b9c6fe3f800b7938dc3d1a2134ac2d0: https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/8494c69d3c710e81|000001d4--2648a9a404_model_tici_ea5efb5b1b9c6fe3f800b7938dc3d1a2134ac2d0.zst<details open><summary>Model Replay Differences</summary><table><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/velocity.x_ea5efb5.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/desiredCurvature_ea5efb5.png"></td></tr><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/leadsV3.x_ea5efb5.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/laneLines.y_ea5efb5.png"></td></tr><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/desireState.laneChangeLeft_ea5efb5.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/desireState.laneChangeRight_ea5efb5.png"></td></tr><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/gasPressProbs_ea5efb5.png"></td></table></details><details ><summary>All Model Replay Plots</summary><table><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/velocity.x_ea5efb5.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads … *[truncated]*

### @commaci-public — 0 reactions  
`—`  ·  [link](https://github.com/commaai/openpilot/pull/34531#issuecomment-2708077183)

> ref for commit af61ff0fc7ca8d9966c7086b77f4fbb09af831c4: https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/8494c69d3c710e81|000001d4--2648a9a404_model_tici_af61ff0fc7ca8d9966c7086b77f4fbb09af831c4.zst<details open><summary>Model Replay Differences</summary><table><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/velocity.x_af61ff0.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/desiredCurvature_af61ff0.png"></td></tr><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/leadsV3.x_af61ff0.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/laneLines.y_af61ff0.png"></td></tr><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/desireState.laneChangeLeft_af61ff0.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/desireState.laneChangeRight_af61ff0.png"></td></tr><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/gasPressProbs_af61ff0.png"></td></table></details><details ><summary>All Model Replay Plots</summary><table><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/velocity.x_af61ff0.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads … *[truncated]*

### @commaci-public — 0 reactions  
`—`  ·  [link](https://github.com/commaai/openpilot/pull/34531#issuecomment-2708453784)

> ref for commit 90452908b7367654c45195f8dcdb492c8d1c831f: https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/8494c69d3c710e81|000001d4--2648a9a404_model_tici_90452908b7367654c45195f8dcdb492c8d1c831f.zst<details open><summary>Model Replay Differences</summary><table><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/velocity.x_9045290.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/desiredCurvature_9045290.png"></td></tr><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/leadsV3.x_9045290.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/laneLines.y_9045290.png"></td></tr><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/desireState.laneChangeLeft_9045290.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/desireState.laneChangeRight_9045290.png"></td></tr><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/gasPressProbs_9045290.png"></td></table></details><details ><summary>All Model Replay Plots</summary><table><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/velocity.x_9045290.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads … *[truncated]*

### @commaci-public — 0 reactions  
`—`  ·  [link](https://github.com/commaai/openpilot/pull/34531#issuecomment-2711752891)

> ref for commit b4eaf1d65b8492aaeae4b6d63ea692c5402c9214: https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/8494c69d3c710e81|000001d4--2648a9a404_model_tici_b4eaf1d65b8492aaeae4b6d63ea692c5402c9214.zst<details open><summary>Model Replay Differences</summary><table><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/desiredCurvature_b4eaf1d.png"></td></table></details><details ><summary>All Model Replay Plots</summary><table><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/velocity.x_b4eaf1d.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/desiredCurvature_b4eaf1d.png"></td></tr><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/leadsV3.x_b4eaf1d.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/laneLines.y_b4eaf1d.png"></td></tr><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/desireState.laneChangeLeft_b4eaf1d.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/desireState.laneChangeRight_b4eaf1d.png"></td></tr><tr><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs/heads/model_replay_online-lag/gasPressProbs_b4eaf1d.png"></td><td><img src="https://raw.githubusercontent.com/commaai/ci-artifacts/refs … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
