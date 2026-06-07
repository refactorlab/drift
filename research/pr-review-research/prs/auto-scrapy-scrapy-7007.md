# scrapy/scrapy #7007 — Optimise `SitemapSpider` memory usage 

**[View PR on GitHub](https://github.com/scrapy/scrapy/pull/7007)**

| | |
|---|---|
| **Author** | @albertedwardson |
| **Status** | ✅ merged |
| **Opened** | 2025-08-12 |
| **Repo importance** | ★62,114 · 11,617 forks · score 113,580 |
| **Diff** | +281 / −55 across 4 files |
| **Engagement** | 35 conversation · 31 inline review comments |

## Top review comments (ranked by reactions)

### @galloj — 1 reactions  
`👍 1`  ·  [link](https://github.com/scrapy/scrapy/pull/7007#issuecomment-3224082762)

> @abebus 
> 
> > you mean it was yielding requests from generator, not list? if it was, it's strange why memory usage dropped, since this generator holds reference to sitemap object, that holds reference to response body
> 
> Yes, I changed `requests = list(self.__get_sitemap_requests(s, self.sitemap_filter(s)))` to `requests = self.__get_sitemap_requests(s, self.sitemap_filter(s))`. The memory usage dropped because the `Request` object is large enough to offset the benefits of freeing the response body.
> 
> ```python3
> from pympler.asizeof import asizeof
> from scrapy import Request
> 
> asizeof(Request("http://example.com"), Request("http://examplz.com")) - asizeof(Request("http://example.com"))
> # 1016
> 
> asizeof("http://example.com", "http://examplz.com") - asizeof("http://example.com")
> # 72
> ```
> 
> Also, the string itself carries some overhead (about 50 bytes), so sometimes, the response body might be smaller than the list of parsed URLs. (On the other hand, it might be significantly bigger if the sitemap also contains images).

### @albertedwardson — 1 reactions  
`😕 1`  ·  [link](https://github.com/scrapy/scrapy/pull/7007#issuecomment-3904480032)

> lol 
> <img width="191" height="66" alt="изображение" src="https://github.com/user-attachments/assets/2b8f742f-7bf8-4db7-b251-a4431c925f6a" />

### @AdrianAtZyte — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/scrapy/scrapy/pull/7007#issuecomment-4118320513)

> Something like this seems to reproduce what you mean:
> 
> ```python
> 
>     def test_parse_sitemap_does_not_retain_response_bodies_for_parallel_parsing(self):
>         spider = self.spider_class("example.com")
> 
>         tracemalloc.start()
>         generators = []
>         for i in range(32):
>             r = XmlResponse(
>                 url=f"http://www.example.com/sitemap-{i}.xml",
>                 body=self._generate_sparse_sitemap_with_padding(i, 300_000),
>             )
>             generators.append(spider._parse_sitemap(r))
> 
>         # Keep parse generators alive, but release all responses to mimic scheduler
>         # queuing many sitemap requests at once.
>         gc.collect()
>         current, _ = tracemalloc.get_traced_memory()
>         tracemalloc.stop()
> 
>         # Current implementation materializes URLs into lists before returning,
>         # so response bodies should be released quickly. A lazy pipeline that
>         # keeps parser state alive would retain ~32 * 300_000 bytes here.
>         assert current < 3_000_000
> 
>         # Sanity-check that all retained generators are still consumable.
>         for g in generators:
>             req = next(iter(g))
>             assert req.url.startswith("https://example.com/page-")
>             
>     def _generate_sparse_sitemap_with_padding(self, idx: int, padding_size: int) -> bytes:
>         padding = b"x" * padding_size
>         return (
>             b'<?xml version="1.0" encoding="UTF-8"?>'
>             b'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
>             b"<url><loc>https://example.com/page-"
>             + str(idx).encode() … *[truncated]*

### @AdrianAtZyte — 1 reactions  
`👍 1`  ·  [link](https://github.com/scrapy/scrapy/pull/7007#issuecomment-4125706197)

> I think you are both right, but before we merge, I would like to have some test that can demonstrate the problem. A test that breaks as you remove the list() casting.

### @AdrianAtZyte — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/scrapy/scrapy/pull/7007#issuecomment-4205913067)

> @kmike, @wRAR, @GeorgeA92 and I had an off-GitHub discussion on the topic, and agreed to move on, that there is definitely a good performance improvement here, that any issue caused by creating too many requests too fast in the scheduler is not an issue with sitemap parsing itself and something better addressed elsewhere (e.g. by using a disk queue for requests), and that the tests I asked for here are not really necessary.
> 
> I will remove the unnecessary tests and merge.
> 
> Thanks!

### @albertedwardson — 0 reactions  
`—`  ·  [link](https://github.com/scrapy/scrapy/pull/7007#issuecomment-3184625360)

> I hope I'm done, it's ready for review 
> Sorry for a lot of commits, this needs to be squashed if everything else is ok


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
