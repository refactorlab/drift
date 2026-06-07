# apache/airflow #56187 — Move the traces and metrics code under a common observability package

**[View PR on GitHub](https://github.com/apache/airflow/pull/56187)**

| | |
|---|---|
| **Author** | @xBis7 |
| **Status** | ✅ merged |
| **Opened** | 2025-09-28 |
| **Repo** | curated review-culture seed |
| **Diff** | +1440 / −502 across 103 files |
| **Engagement** | 82 conversation · 130 inline review comments |

## Top review comments (ranked by reactions)

### @xBis7 — 3 reactions  
`🎉 3`  ·  [link](https://github.com/apache/airflow/pull/56187#issuecomment-3615738151)

> @amoghrajesh @potiuk Thank you for all the help! @jason810496 @ferruzzi @jscheffl Thank you for the reviews!

### @xBis7 — 2 reactions  
`👍 2`  ·  [link](https://github.com/apache/airflow/pull/56187#issuecomment-3522145142)

> @jason810496 Thank you! Green CI at last.

### @xBis7 — 2 reactions  
`👍 2`  ·  [link](https://github.com/apache/airflow/pull/56187#issuecomment-3584293175)

> There were some conflicts with `main` and I had to do another rebase. I'll fix the CI.

### @kaxil — 1 reactions  
`👍 1`  ·  [link](https://github.com/apache/airflow/pull/56187#issuecomment-3410653417)

> > Thanks for the update! The overall change LGMT, but there are still question about the dependencies for Airflow-Core and TaskSDK.
> 
> cc @amoghrajesh  for that part

### @potiuk — 1 reactions  
`👀 1`  ·  [link](https://github.com/apache/airflow/pull/56187#issuecomment-3498846992)

> > @potiuk Thank you!
> > 
> > There are some other issues apart from `prek` adding dependencies. Let's assume that I make the OpenTelemetry dependency optional. What will happen with the OpenTelemetry imports? Won't we get in the CI that the package doesn't exist? I think that's what happened last time I tried this.
> 
> There are ways - we can add a compatibility code with import fallbacks if things are to be made optional. We have quite a number of those - often they require some small refactors and separating out things to a separate package where the fallbacks are handled, but .... this is precisely this kind of move :).
> 
> We also might make some tests optional in this case and depend on presence of open-telemetry, we also might want to make sure that the current code that builds the CI uses those optional dependencies to build the CI image. 
> 
> This is the code (pretty complex) that installs airflow and related packages in CI in the image depending on circumstances:
> 
> https://github.com/apache/airflow/blob/main/scripts/docker/install_airflow_when_building_images.sh#L38 
> 
> So likely this code will need to be updated if opentelemetry is made truly optional, to actually install the extras required 
> 
> This is when I might step-in.

### @potiuk — 1 reactions  
`👍 1`  ·  [link](https://github.com/apache/airflow/pull/56187#issuecomment-3498937575)

> > It would be helpful if you have a PR that made the kind of changes that you are describing. I can take a look at it and then do something similar here and save you some time.
> 
> I am afraid that thre is no single clean PR about that - this was added at the time when we switched to UV - so that PR is likely very massive.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
