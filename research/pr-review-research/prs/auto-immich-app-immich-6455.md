# immich-app/immich #6455 — feat(server): Import face regions from metadata

**[View PR on GitHub](https://github.com/immich-app/immich/pull/6455)**

| | |
|---|---|
| **Author** | @bugfest |
| **Status** | ✅ merged |
| **Opened** | 2024-01-17 |
| **Repo importance** | ★102,681 · 5,792 forks · score 130,849 |
| **Diff** | +1058 / −96 across 48 files |
| **Engagement** | 64 conversation · 151 inline review comments |

## Top review comments (ranked by reactions)

### @bugfest — 5 reactions  
`❤️ 4 · 😄 1`  ·  [link](https://github.com/immich-app/immich/pull/6455#issuecomment-2226838834)

> Hi @mertalev! Sorry I totally missed your comment. I'll review these PR and will resume my work on top of the latest version.
> 
> > Following #10371, faces are no longer required to have embeddings. While it'd be ideal to have them for facial recognition, the feature is still useful outside of that and ties into the possibility of writing facial recognition data as well. Integration with ML can be a later improvement taking advantage of #9973, but shouldn't be a blocker at this point.

### @rhatguy — 3 reactions  
`❤️ 3`  ·  [link](https://github.com/immich-app/immich/pull/6455#issuecomment-1900850379)

> I"ll throw my hat in the ring for demand for the feature.  I am not able to help improve, but maybe provide a few thoughts.  Mylio does something similar to what is being proposed here.  It reads all face metadata from existing pictures and then runs its own face detection and merges those two result sets together.  Mylio seems to use circles around the face to represent a face that it detected and boxes for faces that were only read from metadata and not detected (or manually tagged faces).  This makes it easy for the user to differentiate between the two.  In practice this works really nicely inside the app and lets the user consume previously tagged metadata as well as add new metadata seamlessly.  I suspect they are using vectors from their detection to tag faces from metadata as they are able to "detect" and "recognize" a new face and match it against a face that was created from metadata.  [square vs circle](https://manual.mylio.com/24.0/en/topic/manually-add-a-face-tag)
> 
> I think this is a great initial step and am looking forward to trying it out.

### @bugfest — 3 reactions  
`👍 3`  ·  [link](https://github.com/immich-app/immich/pull/6455#issuecomment-1902676020)

> Thanks for your notes and help offer @mertalev, really appreciate it 😄.
> 
> I'd like to familiarize myself with that part of the code so hopefully I can help in the future to maintain the face-metadata feature. I'll ask for help if I'm not able to provide an implementation in a timely manner (1-2 weeks?). 
> 
> I'll move this PR to draft in the mean time

### @bugfest — 2 reactions  
`👍 2`  ·  [link](https://github.com/immich-app/immich/pull/6455#issuecomment-1899998560)

> > I really appreciate the effort you put into this! It definitely comes across in the code. That being said, there are a few issues and I'm not sure if they can be reconciled.
> 
> Thanks @mertalev! Happy to improve it so this can work alongside the ML face detection. Your insights are very helpful and welcome; I wasn't totally aware of these even thought I tried to read main portions of the code/flow to not to propose something crazy or hard to maintain. 
> 
> > Adding a dummy embedding of 0's _technically_ works, but it isn't really a solution. Besides increasing RAM and storage use, it will add noise to facial recognition as these dummy embeddings will also be considered. A workaround for this could be to move the embeddings to a separate table, but this would require changing queries and introduce another join.
> >
> > The other issue is that it brings a concept of faces that can't actually be used for clustering purposes. When the ML job detects faces, there will very likely be overlap between the faces it detects and the ones imported here, and likewise the clustering will duplicate some of the same people you create in the importing process. The workaround for that would maybe be to add a flag for faces that were imported and do some kind of deduplication between these and ML, e.g. checking bounding boxes, using a cluster similarity metric, etc.
> 
> As an alternative, would it be possible to make `embedding` nullable so that faces from metadata have `embedding==null` and these can be skipped in `searchCLIP` and `searchFaces` by adding a new `where` statement? That would avoid the e … *[truncated]*

### @rhatguy — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/immich-app/immich/pull/6455#issuecomment-2359270067)

> https://exiftool.org/TagNames/XMP.html#acdsee
> 
> Just putting Phil's (exiftool) comments here for reference:
> (A note to software developers: Re-inventing your own private tags instead of using the equivalent tags in standard XMP namespaces defeats one of the most valuable features of metadata: interoperability. Your applications mumble to themselves instead of speaking out for the rest of the world to hear.)
> 
> The following two articles might be helpful in getting exiftool to read/convert Acdsee tags into something more standard.
> https://exiftool.org/forum/index.php?topic=15376.0
> https://exiftool.org/forum/index.php?topic=12377.0

### @mertalev — 1 reactions  
`👍 1`  ·  [link](https://github.com/immich-app/immich/pull/6455#issuecomment-1897579283)

> I'm not sure how I feel about this. It adds a lot of complexity to facial recognition, which is already complex enough as it is. Is the idea for this to be mutually-exclusive with ML facial recognition?


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
