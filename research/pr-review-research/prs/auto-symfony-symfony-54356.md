# symfony/symfony #54356 — [Notifier] LOX24 SMS bridge

**[View PR on GitHub](https://github.com/symfony/symfony/pull/54356)**

| | |
|---|---|
| **Author** | @alebedev80 |
| **Status** | ✅ merged |
| **Opened** | 2024-03-20 |
| **Repo** | curated review-culture seed |
| **Diff** | +1186 / −0 across 22 files |
| **Engagement** | 12 conversation · 144 inline review comments |

## Top review comments (ranked by reactions)

### @alebedev80 — 0 reactions  
`—`  ·  [link](https://github.com/symfony/symfony/pull/54356#issuecomment-2011349518)

> @OskarStark what's data should be by indexes 0 and 1? method `\Symfony\Component\Notifier\Test\TransportFactoryTestCase::createProvider()`
> 
> ```
>     /**
>      * @return iterable<array{0: string, 1: string, 2: TransportInterface}>
>      */
>     abstract public static function createProvider(): iterable;
> 
>  ```

### @OskarStark — 0 reactions  
`—`  ·  [link](https://github.com/symfony/symfony/pull/54356#issuecomment-2011605200)

> Please have a look at other bridges tests

### @alebedev80 — 0 reactions  
`—`  ·  [link](https://github.com/symfony/symfony/pull/54356#issuecomment-2011694572)

> @OskarStark i think i fixed everything which you mentioned. I'm sorry if missed something... 
> Please review code again.

### @OskarStark — 0 reactions  
`—`  ·  [link](https://github.com/symfony/symfony/pull/54356#issuecomment-2051642380)

> Can you please apply the patches by fabbot? 
> https://fabbot.io/report/symfony/symfony/54356/6dbf933f5d1a28edd6c972600b6fe3bed6122c75
> 
> Thanks

### @alebedev80 — 0 reactions  
`—`  ·  [link](https://github.com/symfony/symfony/pull/54356#issuecomment-2051832780)

> @OskarStark  i've fixed everything what could to fix. Please check again

### @alebedev80 — 0 reactions  
`—`  ·  [link](https://github.com/symfony/symfony/pull/54356#issuecomment-2052201164)

> > After my comments we are good to go 👍 Thank you for your patience
> 
> please check again


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
