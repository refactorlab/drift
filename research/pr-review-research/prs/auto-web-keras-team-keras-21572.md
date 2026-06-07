# keras-team/keras #21572 — Add Distillation API to Keras

**[View PR on GitHub](https://github.com/keras-team/keras/pull/21572)**

| | |
|---|---|
| **Author** | @divyashreepathihalli |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @fchollet
> There is an inconsistency in terminology, where these are sometimes referred to as losses and sometimes as strategies. Which is it? We should make the arg name here consistent with the object class name.

### @fchollet
> If these are DistillationLoss subclasses then the arg should be `distillation_losses`. A potential issue with calling them losses is that they're very different from `keras.losses`.

### @hertschuh
> The `FeatureDistillation` strategy uses a method for extracting intermediate layer features that is not robust and will fail for models with non-sequential architectures (e.g., ResNets).

### @hertschuh
> The bulk replace did some weird stuff, in particular in the docstrings

### @gemini-code-assist
> A critical flaw in `FeatureDistillation` limits its use to sequential models, which will prevent it from working with more complex architectures.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
