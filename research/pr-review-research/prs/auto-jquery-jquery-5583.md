# jquery/jquery #5583 — CSS: Drop the cache in finalPropName

**[View PR on GitHub](https://github.com/jquery/jquery/pull/5583)**

| | |
|---|---|
| **Author** | @mgol |
| **Status** | ✅ merged |
| **Opened** | 2024-11-18 |
| **Repo importance** | ★59,833 · 20,421 forks · score 146,470 |
| **Diff** | +26 / −18 across 2 files |
| **Engagement** | 23 conversation · 6 inline review comments |

## Top review comments (ranked by reactions)

### @vlakoff — 1 reactions  
`👍 1`  ·  [link](https://github.com/jquery/jquery/pull/5583#issuecomment-2487610972)

> Good news, I found back my benchmark:
> 
> <details>
> <summary>Benchmark code</summary>
> 
> ```js
> ( function () {
>     const nb = 100000;
> 
>     const emptyStyle = document.createElement( "div" ).style;
>     const finalProps = {};
>     finalProps.color = "color";
> 
>     const T1 = new Date();
>     for ( let i = nb; i--; ) {
>         if ( "color" in finalProps ) {}
>     }
>     const T2 = new Date();
>     for ( let i = nb; i--; ) {
>         if ( "color" in emptyStyle ) {}
>     }
>     const T3 = new Date();
> 
>     console.log( T2 - T1 );
>     console.log( T3 - T2 );
> } )();
> ```
> </details>
> 
> Results for 10,000,000 iterations (in ms, lower is better) on Chrome:
> ```
> 6
> 949
> ```
> 
> The number of iterations is quite high. Although the former is significantly faster, both are very fast.
> For perspective, 10,000 accesses take about 1 ms.
> 
> Same benchmark (10,000,000 iterations) on Firefox:
> ```
> 215
> 362
> ```
> 
> … Agree the cache can be removed.

### @vlakoff — 0 reactions  
`—`  ·  [link](https://github.com/jquery/jquery/pull/5583#issuecomment-2483794385)

> I would prefer to keep the cache, but if you go this way instead, you could go even further and inline the `vendorPropName()` function into `finalPropName()`.
> 
> Just be aware the `name` parameter is overwritten in `vendorPropName()`, so a new variable has to be introduced to preserve the original `name`.
> 
> <details>
> <summary>Code suggestion</summary>
> 
> ```js
> // Returns a potentially-mapped vendor-prefixed property
> export function finalPropName( name ) {
>     // Check for unprefixed property names
>     if ( name in emptyStyle ) {
>         return name;
>     }
> 
>     // Check for vendor-prefixed property names
>     var capName = name[ 0 ].toUpperCase() + name.slice( 1 ),
>         i = cssPrefixes.length;
>     while ( i-- ) {
>         var prefixedName = cssPrefixes[ i ] + capName;
>         if ( prefixedName in emptyStyle ) {
>             return prefixedName;
>         }
>     }
> 
>     // If no matching property is found, return the original name
>     return name;
> }
> ```
> </details>
> 
> Fun fact: I discussed the above function with an AI, and it proposed adding exactly the same cache we're talking about here, even though I hadn't asked for it. It even provided a flawless code for it.

### @timmywil — 0 reactions  
`—`  ·  [link](https://github.com/jquery/jquery/pull/5583#issuecomment-2484179372)

> The cache no longer provides much value (I'm not 100% sure it ever did). Ironically, the suggestion you got from AI could very well be from training on previous versions of jQuery. But, I like your suggestion to inline `vendorPropName`.

### @vlakoff — 0 reactions  
`—`  ·  [link](https://github.com/jquery/jquery/pull/5583#issuecomment-2484283063)

> I have the whole context of the conversation with the AI, and the code it generated has a distinctive coding style.
> 
> I'm certain the result doesn't derive from past jQuery code; instead, the AI figured out that the results could be cached and generated code that perfectly accomplishes it.

### @timmywil — 0 reactions  
`—`  ·  [link](https://github.com/jquery/jquery/pull/5583#issuecomment-2484300791)

> There's no way to be certain of that, even if the code formatting is different. The AI was likely trained on at least some jQuery code given its ubiquity, but that's just an educated guess. Still, it's irrelevant to question of the usefulness of the cache.

### @mgol — 0 reactions  
`—`  ·  [link](https://github.com/jquery/jquery/pull/5583#issuecomment-2486998345)

> Inlining the `vendorPropName` function causes an increase in size:
> ```
> drop-finalPropName-cache @d426bda80dd8d460c070b8d70969a81602609477
>    raw     gz Filename
>     +2     +3 dist/jquery.min.js
>     +2     +5 dist/jquery.slim.min.js
>     +2     +4 dist-module/jquery.module.min.js
>     +2     +6 dist-module/jquery.slim.module.min.js
> ```


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
