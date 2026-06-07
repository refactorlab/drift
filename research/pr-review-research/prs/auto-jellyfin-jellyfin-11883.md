# jellyfin/jellyfin #11883 — Enhance Trickplay

**[View PR on GitHub](https://github.com/jellyfin/jellyfin/pull/11883)**

| | |
|---|---|
| **Author** | @Shadowghost |
| **Status** | ✅ merged |
| **Opened** | 2024-05-30 |
| **Repo importance** | ★52,933 · 4,927 forks · score 77,636 |
| **Diff** | +423 / −54 across 13 files |
| **Engagement** | 50 conversation · 24 inline review comments |

## Top review comments (ranked by reactions)

### @michaelcurry — 9 reactions  
`👍 3 · ❤️ 1 · 🚀 5`  ·  [link](https://github.com/jellyfin/jellyfin/pull/11883#issuecomment-2201121685)

> Was just searching for this functionality within Jellyfin 10.9.6, and came across this PR.  Super cool! 
> Thanks for making this happen @Shadowghost 🎉  I hope it is merged soon.

### @gnattu — 7 reactions  
`👍 7`  ·  [link](https://github.com/jellyfin/jellyfin/pull/11883#issuecomment-2156452048)

> > ´´´ Allow trickplay images to be saved in the media folder ´´´
> > 
> > How is this implemented? Are the trickplay images stored along side each episode/movie like this:
> 
> Current implementation uses a suffixed folder with the same name as the original video file.
> 
> For you example: 
> 
> ```
> \media\movies\movie1\movie1.mkv
> ```
> 
> will have its own trickplay folder:
> 
> ```
> \media\movies\movie1\movie1.trickplay
> ```
> 
> And inside that folder there will be all the trickplay images for that video:
> 
> ```
> \media\movies\movie1\movie1.trickplay\{resolution}-{tilesize}\0.jpg
> ```

### @Shadowghost — 6 reactions  
`👍 6`  ·  [link](https://github.com/jellyfin/jellyfin/pull/11883#issuecomment-2165050238)

> That's up for question right now. I'd say we should check both locations and only respect the setting when it comes to generating and saving/replacing trickplay images.

### @eomanis — 6 reactions  
`👍 5 · 👀 1`  ·  [link](https://github.com/jellyfin/jellyfin/pull/11883#issuecomment-2377862801)

> The way I understand this enhancement is that, once finished, it will be possible to store the Trickplay images in
>  - The "metadata" path, subdirectory "library" (as is currently the case)
>  - The media libraries' file trees themselves
> 
> I neither want the "metadata" directory to blow up in size on my SSD, nor do I want Jellyfin cluttering up the media directories with Trickplay images. It does not have write permissions there anyway, principle of least privilege and all.
> 
> Having Trickplay files sprayed into the media directories would at the very least give me the ick, not to mention that it would also complicate directory listings for my FTP users.
> 
> What I would like is to have a designated Trickplay images directory at a custom path "somewhere off to the side" on the large media file system. Would that be possible?
> 
> If there is no dedicated option for a custom Trickplay images path, do you think a symbolic link from within the "metadata" directory would work?
> 
> At any rate, I do not care for an admin user web interface input for such a custom path; if I could set it with an environment variable that would be sufficient. I mean, how often am I going to change it.

### @thermionic — 3 reactions  
`👍 3`  ·  [link](https://github.com/jellyfin/jellyfin/pull/11883#issuecomment-2223573702)

> > I was thinking about this too and for at least the first implementation the prerequisite will be having the same config. This is because the config is global and if we have multiple different resolutions inconsistently over different movies/series it is impossible to auto-import them.
> 
> If stored with media, could the size and "interval" be part of the path or name of the trickplay files, so that if a different size is "expected" from the config if would create (without overwriting) if not pre-existing?
> 
> From my perspective, the advantage of having them stored with media far outweighs what I would consider to be a minor inconvenience of having to have the trickplay config the same on all hosts that access the media.

### @Shadowghost — 3 reactions  
`👍 3`  ·  [link](https://github.com/jellyfin/jellyfin/pull/11883#issuecomment-2539621132)

> Yes. A lot of people mount their media read only for consumption, so saving anything next to it is impossible.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
