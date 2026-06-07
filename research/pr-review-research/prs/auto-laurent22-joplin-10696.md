# laurent22/joplin #10696 — All: Add new encryption methods based on native crypto libraries

**[View PR on GitHub](https://github.com/laurent22/joplin/pull/10696)**

| | |
|---|---|
| **Author** | @wh201906 |
| **Status** | ✅ merged |
| **Opened** | 2024-07-07 |
| **Repo importance** | ★55,101 · 6,143 forks · score 84,668 |
| **Diff** | +1065 / −60 across 23 files |
| **Engagement** | 40 conversation · 99 inline review comments |

## Top review comments (ranked by reactions)

### @personalizedrefrigerator — 1 reactions  
`🎉 1`  ·  [link](https://github.com/laurent22/joplin/pull/10696#issuecomment-2307496828)

> # Performance comparisons: `react-native-quick-crypto` vs SJCL
> 
> **Note**: Tests were done with a version of Joplin based on https://github.com/laurent22/joplin/pull/10696/commits/701c313d5e9750e3db87de82811e91f742fd1149.
> 
> I've done some performance testing locally with the **StringV1** and **SJCL1a** encryption methods on Android.
> 
> ## StringV1 vs SJCL1a
> 
> **Android: String performance comparison**
> 
> Count | Data size | Data size (kb) | New: Avg. encrypt time | New: Avg. decrypt time | Old: Avg. encrypt time | Old: Avg. decrypt time
> -- | -- | -- | -- | -- | -- | --
> 10 | 100 | 0.1 | 73.8076190996915 | 150.116284700483 | 65.098592299968 | 158.081572600082
> 10 | 1000 | 1 | 76.6367114994675 | 149.64274969995 | 70.9608689997345 | 169.58790760003
> 10 | 10000 | 10 | 121.344438600168 | 173.788265100122 | 177.971953700483 | 241.203018999845
> 10 | 100000 | 100 | 472.483072699979 | 577.664088299498 | 1435.7887332987 | 1199.40091459975
> 10 | 1000000 | 1000 | 4916.80728119984 | 8550.6358207006 | 13280.9705710992 | 11282.2910229001
> 
> **Graphed (logarithmic y-axis scale)**
> 
> ![chart](https://github.com/user-attachments/assets/2d1dbf32-15b9-4458-a9fb-aa16766f8b3d)
> 
> **Graphed (linear y-axis scale)**
> 
> ![chart](https://github.com/user-attachments/assets/ff15c8b1-0308-43dd-adb7-3927ff908578)
> 
> Above, "New" refers to the `StringV1` encryption method. "Old" refers to the `SJCL1a` encryption method.
> 
> **Observations**:
> - The performance difference is most significant for sizes larger than 100 KB.
> - With `react-native-quick-crypto`, it takes 8 seconds to decrypt a 1 MB note. While this is better than the 11s … *[truncated]*

### @personalizedrefrigerator — 1 reactions  
`🎉 1`  ·  [link](https://github.com/laurent22/joplin/pull/10696#issuecomment-2307511165)

> # RNQuickCrypto vs SJCL -- Dev mode
> 
> Also see the [release mode comparison](https://github.com/laurent22/joplin/pull/10696#issuecomment-2307727634).
> 
> ## FileV1 vs SJCL1a
> 
> Count | Data size | Data size (kb) | New: Avg. encrypt time | New: Avg. decrypt time | Old: Avg. encrypt time | Old: Avg. decrypt time
> -- | -- | -- | -- | -- | -- | --
> 10 | 100 | 0.1 | 82.7941269993782 | 102.57811910063 | 67.3776576004922 | 71.0781307987869
> 10 | 1000 | 1 | 102.960934599489 | 110.403661400825 | 80.8596423007548 | 85.4683844998479
> 10 | 10000 | 10 | 152.301172899455 | 182.089269099385 | 246.22118050009 | 281.766638399661
> 10 | 100000 | 100 | 433.450780399144 | 560.478334400803 | 2234.10042900071 | 2278.1110446997
> 10 | 1000000 | 1000 | 7239.66722959951 | 6539.05412600041 | 22127.9305302992 | 21784.6862305999
> 
> ![chart](https://github.com/user-attachments/assets/804e1961-8041-4c09-a81d-43c981f25419)
> 
> <details><summary>Chart (no logarithmic y-axis)</summary>
> 
> ![chart](https://github.com/user-attachments/assets/cda19d14-f15f-463f-9dac-0200434f54da)
> 
> </details>

### @wh201906 — 1 reactions  
`👍 1`  ·  [link](https://github.com/laurent22/joplin/pull/10696#issuecomment-2346661754)

> > * Do tests exist for or would it make sense to add tests for the following cases?
> >   * Using the `Synchronizer` with `EncryptionService` with the new encryption methods (a full sync):
> >     * Notes with resources.
> >     * Plain text notes.
> >     * Empty notes.
> >     * Multiple master keys.
> >     * Invalid data (checking that `Synchronizer` and related logic handles exceptions correctly).
> >     * Android/iOS: Encrypting/decrypting data that contains null characters (`\0`).
> >       - In the past, we've had trouble with null characters and SQLite storage due to how a library was sending information to native code.
> 
> I think for Case 1~4 they have nothing to do with a specific encryption method. They might be tested elsewhere, but I'm not sure about it.
> For Case 5, I added some unit test cases in commit b329c0cf7d8a538936ca1b694a6811718b83e9c2, and the `Synchronizer` related logic test is added in commit [edd2a9002a](https://github.com/laurent22/joplin/pull/10696/commits/edd2a9002a31b0fee4f11ded0a37951543e289ab#diff-22a445c4980cdcbfc2fb6d0e5322d7769567d99acd1d06a4c93d4c500bb1a3b0R369-R372).
> For Case 6, I didn't test it with the `Synchronizer`, but the null characters test is added in commit [26faf260cf](https://github.com/laurent22/joplin/pull/10696/commits/26faf260cf737a701dc68c016e0cd5df661446b0#diff-6782a428b706e9ba2c4c27168072c2d5da336dfe931026ac55e69e79f2e43239R18). This test case covers plaintext with null character in it and it's working. As for the ciphertext, it is always base64 encoded so a null character won't appear in it.
> 
> @personalizedrefrigerator I guess I've c … *[truncated]*

### @laurent22 — 1 reactions  
`🎉 1`  ·  [link](https://github.com/laurent22/joplin/pull/10696#issuecomment-2439724883)

> Ok I think we can merge this then. Many thanks @wh201906 for implementing this important feature, and thanks @personalizedrefrigerator for reviewing and providing support!

### @wh201906 — 1 reactions  
`👍 1`  ·  [link](https://github.com/laurent22/joplin/pull/10696#issuecomment-2474213090)

> > Do you know what could be the reason? It certainly looks like a value somewhere is stored as a byte, but it's checked here as if it was something else, an integer maybe.
> 
> The implementation of `crypto.increaseNonce()` is correct, but my test code is wrong. I only checked the least significant byte of the timestamp part in the nonce, which can overflow after adding 1 to 255, causing a carry-over to the next byte. I mistakenly thought the least significant byte should always increase and wrote the wrong code in the test cases. This issue can only occur when the test is running with timestamps ending in `0xFE` or `0xFF`, so it has a 2/256 chance of being triggered.
> 
> > What I'm wondering though is could it mean that encryption is faulty due to an integer overflow error? Or is that just the test that is not correct?
> 
> It’s just an issue with the test. I'll submit a PR to fix it and add test cases for specific timestamps.
> 
> > And I wonder in terms of security if there could be a flaw - for example a number is expected to be a large integer, but it's in fact just a byte.
> 
> This could happen when dealing with `TypedArray` because elements in it have a fixed range. For the implementations of new crypto methods I think they should be fine because I did consider the type and overflow for the nonce.
> 
> ~~With that said, even in the worst case — the counter part and the timestamp part in the nonce are set to a constant value, the 21 bytes (168 bits) of random number still make the nonce quite unique.~~ I just realized the random number part is updated only when the counter part overflows, … *[truncated]*

### @wh201906 — 0 reactions  
`—`  ·  [link](https://github.com/laurent22/joplin/pull/10696#issuecomment-2227190231)

> @laurent22 @personalizedrefrigerator I thinks it's ready to be merged.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
