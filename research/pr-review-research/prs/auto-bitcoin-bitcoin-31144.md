# bitcoin/bitcoin #31144 — [IBD] multi-byte block obfuscation

**[View PR on GitHub](https://github.com/bitcoin/bitcoin/pull/31144)**

| | |
|---|---|
| **Author** | @l0rinc |
| **Status** | ✅ merged |
| **Opened** | 2024-10-24 |
| **Repo** | curated review-culture seed |
| **Diff** | +363 / −187 across 16 files |
| **Engagement** | 76 conversation · 332 inline review comments |

## Top review comments (ranked by reactions)

### @hodlinator — 3 reactions  
`❤️ 1 · 🚀 2`  ·  [link](https://github.com/bitcoin/bitcoin/pull/31144#issuecomment-2588220255)

> Nodes on local LAN, same commits, both on SSD. Syncing node was laptop running 13th Gen Intel i7, 20 logical cores.
> 
> #### Full node / source
> 
> Made to not have any other connections (verified through running with `-debug=net` for a while).
> 
> Deleted *anchors.dat* & *peers.dat*.
> 
> ```
> ₿ build/src/bitcoind -dbcache=30000 -nofixedseeds -nodnsseed
> ```
> 
> #### Syncing node
> 
> Deleted *~/.bitcoin*.
> 
> ```
> ₿ time build/src/bitcoind -dbcache=30000 -stopatheight=878000 -connect=<sourcenode>
> ```
> 
> #### Results
> 
> | Commit | Wall time |
> |---|---|
> | 433412fd8478923dfdb20044f74c5d1e19fa8dd8 | 3h55m23s (including 8m13s to flush UTXO set to disk) |
> | 898a07e2ab3e5b653ddadc76f2d04d625f35607c (this PR) rebased onto 433412fd8478923dfdb20044f74c5d1e19fa8dd8 | 3h29m52s (including 8m11s to flush UTXO set to disk) |
> 
> => 11.9% speedup

### @maflcko — 2 reactions  
`👍 2`  ·  [link](https://github.com/bitcoin/bitcoin/pull/31144#issuecomment-2450578651)

> > I don't know how to access that, is it part of CI?
> 
> It needs to be run manually. See https://github.com/bitcoin/bitcoin/tree/master/ci#running-a-stage-locally. (`podman run --rm --privileged docker.io/multiarch/qemu-user-static --reset -p yes` may be required to setup qemu-s390x, depending on your setup). Then something like `MAKEJOBS="-j$(nproc)" FILE_ENV="./ci/test/00_setup_env_s390x.sh" ./ci/test_run_all.sh` should run it.
> 
> > Does the test suite pass on it otherwise or was it just curiosity?
> 
> Yes, it should pass on s390x. If not, that is a bug somewhere.

### @fanquake — 2 reactions  
`👍 2`  ·  [link](https://github.com/bitcoin/bitcoin/pull/31144#issuecomment-2471201204)

> > Wouldn't that require a cmake generation step from binary to header which would basically produce the exact same lines as what we have now?
> 
> Yes. See `bench/data/block413567.raw` & `bench/data/block413567.raw.h`, where at build time a header file of ~`125'000` lines is produced.
> 
> > Would it help if I simply extracted it to a separate header file instead?
> 
> I don't think so. The point is more to not add 100'000s of lines of "data" to this repo, which doesn't scale across many benchmarks, creates unusable diffs, leaves (source) files unviewable on GH etc.

### @ryanofsky — 2 reactions  
`👍 1 · ❤️ 1`  ·  [link](https://github.com/bitcoin/bitcoin/pull/31144#issuecomment-2515108628)

> Concept ACK, but curious for more feedback from @maflcko about this PR. The actual code changes here do not seem too complicated but maybe they make the code less generic. I wonder if you think there are concrete downsides to this PR, or if the changes are ok but possibly not be worth the review effort (as https://github.com/bitcoin/bitcoin/pull/31144#issuecomment-2449824362 seems to suggest)
> 
> I'm happy to spend time reviewing this if it improves performance and doesn't cause other problems.
> 
> > this way the histogram data is ~100 kb instead of 1.7 MB
> 
> Current approach seems ok to me, but wondering it it might be better to just use a sampling of the most common write sizes instead of including the entire histogram. It seems like if you take the top 50 sizes it covers 99.6% of the writes, and might make the test more maintainable and PR easier to understand without changing results too much.
> 
> <details><summary>code</summary>
> <p>
> 
> using histogram from https://gist.github.com/l0rinc/a44da845ad32ec89c30525507cdd28ee
> 
> ```python
>     cut = 50
>     hist_count = rest_count = 0
>     histogram.sort(key=lambda h: (-h[1]*h[0]))
>     for i, (size, count) in enumerate(histogram):
>         if i < cut:
>            print(f"{size=}, {count=}")
>            hist_count += count
>         else:
>            rest_count += count
> 
>     print()
>     print(f"{hist_count=} {hist_count/(hist_count+rest_count)*100:.1f}%")
>     print(f"{rest_count=} {rest_count/(hist_count+rest_count)*100:.1f}%")
> ```
> </p>
> </details>
> 
> <details><summary>sizes</summary>
> <p>
> 
> ```
> size=32, count=5369404406
> size=106, count=1193555153
> size=71 … *[truncated]*

### @l0rinc — 2 reactions  
`👍 2`  ·  [link](https://github.com/bitcoin/bitcoin/pull/31144#issuecomment-2515212570)

> > Would still be nice to if there was a way to take all of it out of the hot path
> 
> Can you give me hints on how to do that?
> Since we have a primitive as a key now, we already skip xor with 0 value now, see https://github.com/bitcoin/bitcoin/pull/31144/files#diff-4020c723bb55e114bdc7ff769086a765dcc7ccfb61da2047a315db16c0c7a8b4R295
> 
> > but wondering it it might be better to just use a sampling of the most common write sizes
> 
> @fanquake mentioned that he thinks this benchmark could be useful - if he's fine with the truncated version as well, I'll simplify (would solve some of @hodlinator's cmake concerns as well).

### @l0rinc — 2 reactions  
`👍 1 · 🚀 1`  ·  [link](https://github.com/bitcoin/bitcoin/pull/31144#issuecomment-2519764142)

> > Would still be nice to if there was a way to take all of it out of the hot path
> 
> Since blocks are XOR-ed as well, I can't meaningfully test it with a reindex(-chainstate), so I did 2 full IBDs until 800k blocks, rebased after https://github.com/bitcoin/bitcoin/pull/30039 with `-blocksxor=0` to test whether we can disable xor completely now.
> 
> <details>
> <summary>benchmark</summary>
> 
> ```bash
> hyperfine \
> --runs 2 \
> --export-json /mnt/my_storage/IBD-xor-rebased.json \
> --parameter-list COMMIT e1074081c9f1895a4f629dfee347ceae484a10d3,f2fd1f7c043a2782cb2bf3c9fe7e2f94c17728b5 \
> --prepare 'rm -rf /mnt/my_storage/BitcoinData/* && git checkout {COMMIT} && git clean -fxd && git reset --hard && cmake -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_UTIL=OFF -DBUILD_TX=OFF -DBUILD_TESTS=OFF -DENABLE_WALLET=OFF -DINSTALL_MAN=OFF && cmake --build build -j$(nproc)' \
> 'COMMIT={COMMIT} ./build/src/bitcoind -datadir=/mnt/my_storage/BitcoinData -stopatheight=800000 -blocksxor=0 -dbcache=10000 -printtoconsole=0'
> ```
> 
> </details>
> 
> ```bash
> Benchmark 1: COMMIT=e1074081c9f1895a4f629dfee347ceae484a10d3 ./build/src/bitcoind -datadir=/mnt/my_storage/BitcoinData -stopatheight=800000 -blocksxor=0 -dbcache=10000 -printtoconsole=0
>   Time (mean ± σ):     25797.921 s ± 61.629 s    [User: 26803.189 s, System: 1457.936 s]
>   Range (min … max):   25754.343 s … 25841.500 s    2 runs
>  
> Benchmark 2: COMMIT=f2fd1f7c043a2782cb2bf3c9fe7e2f94c17728b5 ./build/src/bitcoind -datadir=/mnt/my_storage/BitcoinData -stopatheight=800000 -blocksxor=0 -dbcache=10000 -printtoconsole=0
>   Time (mean ± σ):     23751.046 s ± 342.376 s    [ … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
