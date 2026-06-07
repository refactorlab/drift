# shadcn-ui/ui #8486 — feat: update chart to recharts v3

**[View PR on GitHub](https://github.com/shadcn-ui/ui/pull/8486)**

| | |
|---|---|
| **Author** | @shadcn |
| **Status** | ✅ merged |
| **Opened** | 2025-10-16 |
| **Repo importance** | ★115,750 · 8,990 forks · score 156,694 |
| **Diff** | +559 / −374 across 63 files |
| **Engagement** | 21 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @arolariu — 19 reactions  
`❤️ 19`  ·  [link](https://github.com/shadcn-ui/ui/pull/8486#issuecomment-3627835576)

> For anyone stumbling upon this while this PR is still active and wants to try out the `chart.tsx` for Recharts v3+, here's the complete file as drop-in replacement, credits to @noxify and @firxworx for their hard work.
> 
> ```tsx
> "use client";
> 
> /* eslint-disable */
> 
> import {cn} from "@/lib/utils";
> import * as React from "react";
> import * as RechartsPrimitive from "recharts";
> import type {NameType, ValueType} from "recharts/types/component/DefaultTooltipContent";
> 
> // Format: { THEME_NAME: CSS_SELECTOR }
> const THEMES = {light: "", dark: ".dark"} as const;
> 
> export type ChartConfig = Record<
>   string,
>   {
>     label?: React.ReactNode;
>     icon?: React.ComponentType;
>   } & ({color?: string; theme?: never} | {color?: never; theme: Record<keyof typeof THEMES, string>})
> >;
> 
> interface ChartContextProps {
>   config: ChartConfig;
> }
> 
> const ChartContext = React.createContext<ChartContextProps | null>(null);
> 
> function useChart() {
>   const context = React.useContext(ChartContext);
> 
>   if (!context) {
>     throw new Error("useChart must be used within a <ChartContainer />");
>   }
> 
>   return context;
> }
> 
> interface ChartContainerProps
>   extends
>     Omit<React.ComponentProps<"div">, "children">,
>     Pick<
>       React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>,
>       "initialDimension" | "aspect" | "debounce" | "minHeight" | "minWidth" | "maxHeight" | "height" | "width" | "onResize" | "children"
>     > {
>   config: ChartConfig;
>   innerResponsiveContainerStyle?: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["style"];
> }
> 
> function ChartContainer({
>   id,
>   config,
>   init … *[truncated]*

### @noxify — 6 reactions  
`❤️ 6`  ·  [link](https://github.com/shadcn-ui/ui/pull/8486#issuecomment-3455756313)

> Tested the chart component and everything seems to work.
> 
> With the current state, you will have one or more warnings in the browser console:
> 
> > The width(-1) and height(-1) of chart should be greater than 0,
> >       please check the style of container, or the props width(100%) and height(100%),
> >       or add a minWidth(0) or minHeight(undefined) or use aspect(undefined) to control the
> >       height and width.
> 
> Based on https://github.com/recharts/recharts/issues/2736, you can fix it by updating the `ChartContainer`.
> 
> Just replace:
> 
> ```tsx
> <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
> ```
> 
> with: 
> 
> ```tsx
> <RechartsPrimitive.ResponsiveContainer initialDimension={ { width: 320, height: 200 } }>{children}</RechartsPrimitive.ResponsiveContainer>
> ```

### @fionnachan — 5 reactions  
`👍 5`  ·  [link](https://github.com/shadcn-ui/ui/pull/8486#issuecomment-3823176292)

> @shadcn hello what's the status of this PR? hoping to migrate our charts from recharts v3 to using shadcn.

### @fanqflo — 4 reactions  
`👍 4`  ·  [link](https://github.com/shadcn-ui/ui/pull/8486#issuecomment-3861625129)

> Since v3.3 of Recharts (https://github.com/recharts/recharts/releases/tag/v3.3.0), "ResponsiveContainer is now built-in to all charts.  ... ResponsiveContainer will continue to work for the life of 3.x"
> 
> Leaving the  ResponsiveContainer wrapper in for the ShadCn wrapper, would ease the migration burden I would argue. Still a lot of "Wrappers".

### @bobeagan — 4 reactions  
`👍 3 · 👀 1`  ·  [link](https://github.com/shadcn-ui/ui/pull/8486#issuecomment-4013894295)

> @shadcn any chance of getting this component updated so that we can make use of the newest recharts version?

### @noxify — 4 reactions  
`👍 2 · 🎉 2`  ·  [link](https://github.com/shadcn-ui/ui/pull/8486#issuecomment-4110071623)

> @shadcn LGTM and should fix it. 
> 
> > RechartsPrimitive.TooltipValueType should be able to use that instead.
> 
> If I'm not wrong, you're using this syntax also in other components, but as rubixvi said, it's just a preference and the result is/should be the same


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
