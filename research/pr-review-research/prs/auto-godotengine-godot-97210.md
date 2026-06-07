# godotengine/godot #97210 — Add an ObjectDB Profiling Tool

**[View PR on GitHub](https://github.com/godotengine/godot/pull/97210)**

| | |
|---|---|
| **Author** | @AleksLitynski |
| **Status** | ✅ merged |
| **Opened** | 2024-09-19 |
| **Repo** | curated review-culture seed |
| **Diff** | +3885 / −24 across 34 files |
| **Engagement** | 44 conversation · 234 inline review comments |

## Top review comments (ranked by reactions)

### @Repiteo — 14 reactions  
`🎉 14`  ·  [link](https://github.com/godotengine/godot/pull/97210#issuecomment-3366517843)

> Thanks! Congratulations on your first merged contribution! 🎉

### @mrTag — 10 reactions  
`👍 10`  ·  [link](https://github.com/godotengine/godot/pull/97210#issuecomment-2754754067)

> I checked out this PR to do some profiling for our game, Halls of Torment, and I love it! Thanks Aleks, for such a great tool! Exactly what I was missing in my profiling endeavors! The data insight is excellent. The only problem I am having is the performance of the tool itself.
> 
> When I take a snapshot in the campfire scene of our game (not that much going on there), it takes around 7 minutes! The capturing and transferring of the snapshot is super fast, most of the time is spent in the "Visualizing Snapshot" phase. I did some poor-man's sampling profiling (attaching a debugger and pausing the execution a few times to see where in the callstack most time is spent) and here are the results:
> The absolute majority is spent in GameStateSnapshot::create_ref in the for loop, iterating over the snapshot_data. The snapshot_data contains 300 000 elements in my case, so around 75 000 `SceneDebuggerObject` have to be created (4 array elements per object). One immediate improvement / bugfix is slicing the array correctly (snapshot_data.cpp line 269):
> ```cpp
> // the current state: this will slice from i to the end of the very large array! for every object!
> Array sliced = snapshot_data.slice(i);
> // this will only take the 4 array elements neccessary:
> Array sliced = snapshot_data.slice(i, i + 4);
> ```
> It would probably be even better to not create a new array and extract the 4 data points directly in the loop and then use those:
> ```cpp
> uint64_t id = uint64_t(snapshot_data[i]);
> String class_name = snapshot_data[i+1];
> Array props = snapshot_data[i+2];
> Dictionary extra_data = snapshot_data[i+3 … *[truncated]*

### @Adrenesis — 5 reactions  
`👍 5`  ·  [link](https://github.com/godotengine/godot/pull/97210#issuecomment-3065960483)

> I tested this PR on my game, and it allowed me to find every memory leaks in my game in less than 1 hour, so to me on a user point of view that's a big yes. 
> 
> It's very efficient and well done. I also want to mention, that this is a very important feature for Godot to have. As far as I'm concerned stable release should implement it asap.

### @AleksLitynski — 4 reactions  
`👍 4`  ·  [link](https://github.com/godotengine/godot/pull/97210#issuecomment-2872682443)

> > @AleksLitynski Do you mind if @mihe and I take over the PR to bring it to the finish line? If seems like the option for maintainer to push edits is enabled so GitHub would let us push to your PR branch directly.
> 
> @akien-mga - feel free to push (or force push) to the PR. Sorry I haven't been very active on this lately. 
> 
> Before this merges, there are a few things bothering me that other people haven't brought up -
> 1. Will this still work if a .tscn has been deleted from the project since a snapshot was taken?
> 2. When I detect reference cycles on the RefCounted tab, is my logic correct? Is it even useful to count references if most references aren't visible in the ObjectDB?
> 3. Is the overview page actually useful and correct?
> 4. Should I write documentation for this somewhere?

### @AleksLitynski — 3 reactions  
`👍 3`  ·  [link](https://github.com/godotengine/godot/pull/97210#issuecomment-2380859316)

> I think this is ready for another review. Some notes on the changes I've made:
> 
> ### Fixed: 
> * Snapshots now include the version of the game client and the editor. Visible in the summary view.
> * Removed underlines on summary page and added a little more whitespace.
> * Timestamps are now in local time.
> * Snapshots are now compressed. I compress them in the game itself so sending the snapshot from the game to the editor is faster.
> * When adding compression, I removed the concept of a version number from the .odb_snapshot file. I was never sure how it should work, and compressing the file made it harder to imagine it being useful. My current thought is we can add a .odb_snapshot_2 file extension if we change the file contents.
> * Log messages changed to `print_verbose`
> * Fixed bottom panel overflowing on objects tab and refcounted tab. It was the content on the far right that forced the rest to overflow, so that content now scrolls when too small.
> * Diff against works as described. Selected snapshot is greyed out and snapshots swap when you selected the currently diffed snapshot.
> * The JSON view now uses the same visualizer as the native shader visualizer. Instead of copy/pasting all those properties, I refactored the native shader visualizer into a new control (editor_json_visualizer.h) that gets used in both panels.
> * RefCounteds are weird, because the engine holds half the references, and the references in the ObjectDB can be exposed by multiple getters. I updated the RefCounted panel to make the data as clear as possible. I think this panel is only really going to make sense … *[truncated]*

### @AleksLitynski — 3 reactions  
`👍 2 · 👀 1`  ·  [link](https://github.com/godotengine/godot/pull/97210#issuecomment-2594084865)

> I'm finally getting back to this after a busy few months. I think I fixed everything folks left comments about.
> 
> @mihe I made the change described here - https://github.com/godotengine/godot/pull/97210#issuecomment-2517340525. Can you let me know if you're project is snapshot-able now?


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
