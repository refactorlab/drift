# Farama-Foundation/Gymnasium #934 — [Bug fix] remove `mujoco-py` import error for v4+ MuJoCo environments

**[View PR on GitHub](https://github.com/Farama-Foundation/Gymnasium/pull/934)**

| | |
|---|---|
| **Author** | @MischaPanch |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Kallinteris-Andreas
> As I said in the issue with regard to `baseMujocoEnv`, do not move it from `mujoco.py` instead create copy in `mujoco_py_env.py`

### @Kallinteris-Andreas
> `MujocoPyEnv` should be in its own file with nothing external affecting it, `BaseMujocoEnv` will eventually be 'merged' with `MujocoEnv`

### @Kallinteris-Andreas
> To fix the failing test change assert isinstance(env, BaseMujocoEnv) to assert isinstance(env, BaseMujocoEnv) or isinstance(env, BaseMujocoPyEnv)

### @MischaPanch
> Three files are needed to enable importing from say mujoco_py without importing from mujoco

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
