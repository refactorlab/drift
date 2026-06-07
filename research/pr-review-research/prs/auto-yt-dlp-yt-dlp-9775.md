# yt-dlp/yt-dlp #9775 — [ie/youtube] Extract comments with or without new format

**[View PR on GitHub](https://github.com/yt-dlp/yt-dlp/pull/9775)**

| | |
|---|---|
| **Author** | @jakeogh |
| **Status** | ✅ merged |
| **Opened** | 2024-04-24 |
| **Repo importance** | ★168,135 · 14,140 forks · score 229,553 |
| **Diff** | +56 / −8 across 1 files |
| **Engagement** | 40 conversation · 48 inline review comments |

## Top review comments (ranked by reactions)

### @minamotorin — 4 reactions  
`👍 4`  ·  [link](https://github.com/yt-dlp/yt-dlp/pull/9775#issuecomment-2098495536)

> @bbilly1 
> 
> > Did you encounter any problems when using yt-dlp or is that just an observation in the browser?
> 
> This is just an observation in the browser.
> My comment was just a sharing of information, not a bug report.
> 
> @coletdjnz 
> > Extracting it in another lang would be complex/difficult, so I wouldn't worry about it in this PR.
> 
> I agree. This PR seems to work fine now.

### @bbilly1 — 3 reactions  
`👍 3`  ·  [link](https://github.com/yt-dlp/yt-dlp/pull/9775#issuecomment-2097006675)

> Very nice, appreciate the progress. I'm still seeing some problems with extracting `like_count`, that can have a unit to it for numbers bigger than 1000, e.g. `2.3K likes`. So just extracting the int out of that will miss the multiplier. 
> 
> Luckily that is already handled in `parse_count`, we just need to pass it through that instead of `str_to_int`. This has been working in my testing:
> 
> ```patch
> diff --git a/yt_dlp/extractor/youtube.py b/yt_dlp/extractor/youtube.py
> index a70c10d64..d12285cba 100644
> --- a/yt_dlp/extractor/youtube.py
> +++ b/yt_dlp/extractor/youtube.py
> @@ -3314,7 +3314,7 @@ def _extract_comment(self, view_model, entities, parent=None):
>          info = {
>              'id': comment_id,
>              'text': try_get(comment_entity_payload, lambda x: x['properties']['content']['content'], str),
> -            'like_count': str_to_int(self._search_regex(r'^([\d]+)', try_get(comment_entity_payload, lambda x: x['toolbar']['likeCountA11y'], str), 'like_count', fatal=False)) or 0,
> +            'like_count': parse_count(try_get(comment_entity_payload, lambda x: x['toolbar']['likeCountA11y'], str)) or 0,
>              'author_id': traverse_obj(comment_entity_payload, ('author', 'channelId', {self.ucid_or_none})),
>              'author': try_get(comment_entity_payload, lambda x: x['author']['displayName'], str),
>              'author_thumbnail': traverse_obj(comment_entity_payload, ('author', 'avatarThumbnailUrl', {url_or_none})),
> ```
> This uses the same `try_get` approach as before.

### @jakeogh — 3 reactions  
`👍 1 · ❤️ 2`  ·  [link](https://github.com/yt-dlp/yt-dlp/pull/9775#issuecomment-2097077933)

> This might be ready to go. like_count > 1000 works here.

### @githb123 — 3 reactions  
`❤️ 2 · 👎 1`  ·  [link](https://github.com/yt-dlp/yt-dlp/pull/9775#issuecomment-2109865232)

> @pukkandan When is this going to be released? It's been over 2 months now since the problem is known. A working pull request sits waiting for a week. I bet many of us see this feature as 2nd critical right after the downloading the videos itself.

### @shoxie007 — 2 reactions  
`👍 2`  ·  [link](https://github.com/yt-dlp/yt-dlp/pull/9775#issuecomment-2074980879)

> I read and re-read @minamotorin's [comment](https://github.com/yt-dlp/yt-dlp/issues/9358#issuecomment-2073888559) and found it intriguing:
> > likeCountLiked is used when the user click “like button”, and otherwise likeCountNotLiked is used.
> 
> I put this definition to the test. I loaded a video with a logged-in Youtube account, as this is the only way that field likeCountLiked can mean anything. I hit the like button for one or more comments, then re-loaded the comments, then studied the JSON response. Here is what the fields in the JSON mean:
> - likeCountLiked = 1 if you've liked ANY comment (not just the one particular comment in question) in the entire comment section, and no one else has liked the comment. 
>    - But then, likeCountLiked = (1 + likeCountNotLiked) if others have liked the comment. To reiterate, even if you didn't like the particular comment, still 1 is added. The 1 denotes that you liked at least one comment in the entire comments section.
>    - What a nonsensical data value! I can't think of a scenario in which it would be meaningful and useful.
> - likeCountNotLiked = total number of likes by other users besides you. So if you've liked a comment, and 9 others have also liked the comment, bringing the total to 10 likes, the value of likeCountNotLiked is actually 9. However, if you're logged out of the Youtube account, likeCountNotLiked will equal the total number of likes, in this case 10.
> 
> I tested your extractor as it currently is and it reflected these values. 
> 
> So I'll repeat what I wrote in my first comment: Please obtain the like_count from key likeCountA … *[truncated]*

### @shoxie007 — 2 reactions  
`👍 2`  ·  [link](https://github.com/yt-dlp/yt-dlp/pull/9775#issuecomment-2094659315)

> Are you still with us @jakeogh? Would you kindly integrate the changes proposed?:
> 1. [Add commentRenderer in code for check_get_keys](https://github.com/yt-dlp/yt-dlp/pull/9775#issuecomment-2076424457)
> 2. [Modify extract_thread and _extract_comment to take account of the fact that the heartState key is in a different entity](https://github.com/yt-dlp/yt-dlp/pull/9775#issuecomment-2078531612)
> 
> I've tested the code on numerous videos. It's working. Let's get this pull request merged ASAP. People have been asking and wondering about the broken comments extraction.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
