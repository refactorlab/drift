# streamlit/streamlit #9404 — st.experimental_audio_input

**[View PR on GitHub](https://github.com/streamlit/streamlit/pull/9404)**

| | |
|---|---|
| **Author** | @sfc-gh-nbellante |
| **Status** | Merged (September 25, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @raethlein
> we unfortunately do not handle this consistently across widgets, but I want to highlight that using a Streamlit-defined type might not be the best UX because the developer sees the type, but has to click on it to get what it really means

### @lukasmasuch
> The case where it doesn't work well is when it is missing the microphone permission (maybe the `StyledWaveformContainerDiv` needs an `overflow: hidden`?)

### @lukasmasuch
> Another observation: clicking on start recording - if there is already an old recording - triggers a rerun. This rerun seems to be a bit unnecessary. Is this expected?

### @lukasmasuch
> or delete the old recording file only on `stopRecording` before uploading the new data (maybe the safer option)

### @sfc-gh-braethlein
> I think this is another aspect we should codify: whether or not to use `optional` I think we use it pretty inconsistently

### @kajarenc
> We need to think carefully about exact types (especially for file-uploader, data-editor like widgets). But on the strategic level, it is something we should do at some point!

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
