# topjohnwu/Magisk #8293 — Use `androidboot.partition_map` as a fallback for matching partition names in the preinit finding.

**[View PR on GitHub](https://github.com/topjohnwu/Magisk/pull/8293)**

| | |
|---|---|
| **Author** | @chsbuffer |
| **Status** | ✅ merged |
| **Opened** | 2024-08-07 |
| **Repo importance** | ★60,794 · 17,612 forks · score 136,167 |
| **Diff** | +44 / −12 across 3 files |
| **Engagement** | 17 conversation · 19 inline review comments |

## Top review comments (ranked by reactions)

### @chsbuffer — 1 reactions  
`👀 1`  ·  [link](https://github.com/topjohnwu/Magisk/pull/8293#issuecomment-2275475764)

> > partition_map was added since Android 13; bootconfig was added since Android 12, so I think we only need to parse bootconfig.
> 
> Google Play Games passes `androidboot.partition_map` via kernel cmdline, and [the AOSP code](https://android.googlesource.com/platform/system/core/+/refs/heads/android13-release/init/devices.cpp#191) also parse both bootconfig and kernel cmdline.
> 
> The partition_map might be considered dynamic, I assume that the bootconfig is hardcoded in the ROM and can't be changed, so Google Play Games Emulator does the cmdline way.

### @yujincheng08 — 0 reactions  
`—`  ·  [link](https://github.com/topjohnwu/Magisk/pull/8293#issuecomment-2273954140)

> Doesn't `magisk --preinit-device` print the device name before mapping? Like the following
> 
> ![QQ_1723051068867](https://github.com/user-attachments/assets/ec0eb15e-5c3f-4d89-a9bc-bdfc89d3de56)

### @chsbuffer — 0 reactions  
`—`  ·  [link](https://github.com/topjohnwu/Magisk/pull/8293#issuecomment-2274780884)

> `magisk --preinit-device`:
> ```
> resetprop: get prop [ro.crypto.state]: [encrypted]
> resetprop: get prop [ro.crypto.type]: [file]
> resetprop: get prop [ro.crypto.metadata.enabled]: [true]
> metadata
> ```
> -----------------------------
> a script replicates magiskinit SecondStageInit [collect_devices](https://github.com/topjohnwu/Magisk/blob/54d8cb9734efff71e4dbe6b1837e28cc0fdc18d1/native/src/init/mount.cpp#L46)
> ```shell
> parse_device() {
>   local device_name="$1"
>   local devpath=$(readlink -f "/sys/dev/block/$device_name")
>   local uevent_file="/sys/dev/block/$device_name/uevent"
>   local dm_name_file="/sys/dev/block/$device_name/dm/name"
>         while IFS='=' read -r key value; do
>           case "$key" in
>             MAJOR)
>               local major="$value"
>               ;;
>             MINOR)
>               local minor="$value"
>               ;;
>             DEVNAME)
>               local devname="$value"
>               ;;
>             PARTNAME)
>               local partname="$value"
>               ;;
>           esac
>         done < "$uevent_file"
>   local dmname=$(cat "$dm_name_file" 2>/dev/null) || dm_name=""
> 
>   printf "%-18s\t%-18s\t%-18s\t%s\n" "$partname" "$dmname" "$devname" "$devpath"
> }
> 
> printf "%-18s\t%-18s\t%-18s\t%s\n" "partname" "dmname" "devname" "devpath"
> for device in /sys/dev/block/*; do
>    parse_device "$(basename "$device")"
> done
> ```
> output:
> ```
> partname                dmname                  devname                 devpath
>                                                 ram0                    /sys/devices/virtual/block/ram0
>                                                 ram1 … *[truncated]*

### @chsbuffer — 0 reactions  
`—`  ·  [link](https://github.com/topjohnwu/Magisk/pull/8293#issuecomment-2274810880)

> [mountinfo.txt](https://github.com/user-attachments/files/16536738/mountinfo.txt)

### @chsbuffer — 0 reactions  
`—`  ·  [link](https://github.com/topjohnwu/Magisk/pull/8293#issuecomment-2274815702)

> [mounts.txt](https://github.com/user-attachments/files/16536776/mounts.txt)

### @chsbuffer — 0 reactions  
`—`  ·  [link](https://github.com/topjohnwu/Magisk/pull/8293#issuecomment-2274819901)

> Do you think maybe the fix should be a magisk `find_preinit_device()` change instead of a magiskinit change?


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
