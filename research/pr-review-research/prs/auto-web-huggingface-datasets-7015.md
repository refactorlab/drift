# huggingface/datasets #7015 — add split argument to Generator

**[View PR on GitHub](https://github.com/huggingface/datasets/pull/7015)**

| | |
|---|---|
| **Author** | @piercus |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @albertvillanova
> I would propose to define the `split` parameter just as an attribute of `GeneratorConfig` instead of `Generator`, `Generator InputStream`, `AbstractDatasetInputStream` and `SqlDatasetReader`.

### @albertvillanova
> This docstring should go below `<Added version="2.7.0"/>`, because the version added tag corresponds to the `num_proc` parameter above `split`.

### @albertvillanova
> I would suggest to align its type with the rest of the code as: `([`NamedSplit`], defaults to `Split.TRAIN`)`.

### @albertvillanova
> I would add a specific `test_dataset_from_generator_split` with a parametrized `split` values, such as not passing any value, passing `NamedSplit("train")`, passing literal `"train"`, passing other NamedSplit, etc.

### @albertvillanova
> Note the CI action to generate the docs is failing due to an unrelated issue...if we do not want to break the generation of docs, this other PR should be merged before yours: #7036

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
