# huggingface/datasets #7207 — apply formatting after iter_arrow to speed up format -> map, filter for iterable datasets

**[View PR on GitHub](https://github.com/huggingface/datasets/pull/7207)**

| | |
|---|---|
| **Author** | @alex-hh |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @lhoestq
> Interesting ! Let's validate if we get the same speed on those 2 ? 1. Dataset.to_iterable_dataset -> numpy format 2. Dataset.to_iterable_dataset -> numpy format -> batched map identity

### @lhoestq
> You can still do `ds = ds.map(...).with_format(None)` and no formatting will be applied to the output

### @lhoestq
> Maybe name it `input_iterator` or something like that since it's not necessarily batched ?

### @lhoestq
> Originally we tried to keep `formatting` as an attribute of the `IterableDataset` so that people can change formatting without creating nested iterables. What is the rationale for removing it from here?

### @lhoestq
> the output of Dataset.map is written as Arrow data on disk, but when the data is accessed it's formatted using the Dataset format type (map doesn't change the format)

### @lhoestq
> I took the liberty to add a test and do slight changes to fix other tests :) IterableDataset is much faster now than before your changes

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
