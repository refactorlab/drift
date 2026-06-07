# microsoft/PowerToys #46915 — CmdPal Dock: Multi-monitor support

**[View PR on GitHub](https://github.com/microsoft/PowerToys/pull/46915)**

| | |
|---|---|
| **Author** | @michaeljolley |
| **Status** | ✅ merged |
| **Opened** | 2026-04-12 |
| **Repo importance** | ★133,794 · 8,036 forks · score 170,937 |
| **Diff** | +2946 / −178 across 30 files |
| **Engagement** | 22 conversation · 80 inline review comments |

## Top review comments (ranked by reactions)

### @zadjii-msft — 0 reactions  
`—`  ·  [link](https://github.com/microsoft/PowerToys/pull/46915#issuecomment-4277551036)

> Hm. So we don't have a setting to control _which_ monitors dock is visible on, huh. Like, I think I only want dock on one or two of my 4 displays. Seems like we just copy pasta the old config to the other displays on upgrade.

### @zadjii-msft — 0 reactions  
`—`  ·  [link](https://github.com/microsoft/PowerToys/pull/46915#issuecomment-4281985589)

> Misc notes from selfhost:
> * [x] Need to figure out where the per-mon settings actually went. How'd they get reverted?
> * [x] Clicking on list pages pinned to the dock opens cmdpal... off in space? It's not opening "attached" to the dock item anymore. Something about the scaling is wrong
> * [x] Can we add the display name to this list? as it is, I have no idea which display is which.
>   <img width="456" height="406" alt="image" src="https://github.com/user-attachments/assets/37f319fc-98df-4874-8fc4-df42f55951c5" />
> * [x] When updating to this build, the "show title"/subtitle setting got lost from every item, so I had to go manually re-set that, on a bunch of them.
> * [ ] In fact, when we're migrating the old settings to this new build, we shouldn't copy all the existing bands to those other displays. That doesn't feel right - now I have to go manually unpin 3 of the 4 copies of every band I had 😕

### @michaeljolley — 0 reactions  
`—`  ·  [link](https://github.com/microsoft/PowerToys/pull/46915#issuecomment-4283754234)

> @copilot resolve the merge conflicts in this pull request

### @Copilot — 0 reactions  
`—`  ·  [link](https://github.com/microsoft/PowerToys/pull/46915#issuecomment-4283828478)

> > @copilot resolve the merge conflicts in this pull request
> 
> Resolved the merge conflict in `DockWindow.xaml.cs` in commit e4165e5. The resolution keeps per-monitor `EffectiveSide` (for monitor-specific dock side overrides) while adopting main's `EffectiveDockSize()` method and the updated `DockSize` enum (`Default`/`Compact`).
> 
> > Misc notes from selfhost:
> > * [x] Need to figure out where the per-mon settings actually went. How'd they get reverted?
> > * [x] Clicking on list pages pinned to the dock opens cmdpal... off in space? It...
> 
> Fixed in commit e4165e5 — `MonitorConfigReconciler` Phase 3 now creates new secondary monitor configs with `IsCustomized = true` and empty band lists, so they start with no pinned items. The primary monitor still inherits global bands (seamless upgrade path). Added tests: `Reconciler_NewPrimaryMonitor_InheritsGlobalBands` and `Reconciler_NewSecondaryMonitor_StartsWithEmptyBands`.
> 
> > [!WARNING]
> >
> > <details>
> > <summary>Firewall rules blocked me from connecting to one or more addresses (expand for details)</summary>
> >
> > #### I tried to connect to the following addresses, but was blocked by firewall rules:
> >
> > - `o3svsblobprodcus318.vsblob.vsassets.io`
> >   - Triggering command: `/usr/bin/dotnet dotnet build Tests/Microsoft.CmdPal.UI.ViewModels.UnitTests/Microsoft.CmdPal.UI.ViewModels.UnitTests.csproj -c Debug /p:Platform=x64` (dns block)
> >
> > If you need me to access, download, or install something from one of these locations, you can either:
> >
> > - Configure [Actions setup steps](https://gh.io/copilot/actions-setup-steps) to set up my environment, … *[truncated]*

### @zadjii-msft — 0 reactions  
`—`  ·  [link](https://github.com/microsoft/PowerToys/pull/46915#issuecomment-4442618990)

> Hey, so I spawn a build with the most recent multi-mon changes just to see what it felt like in release. And so far, it feels really quite good. The dragging between docks - yeah, we should definitely have that.
> 
> I think the only thing that I still feel like we're is weird is that the settings are saved under the device ID (?). So like, each dock gets customized under `"MonitorDeviceId": "\\\\.\\DISPLAY1",` (etc, etc). But like, if I have three external displays, and customize `DISPLAY2`, then unplug `DISPLAY2`, then it'll shunt the whole display2 band over to a different display. And my laptop dock/displays are funky and reorder themselves with some frequency.
> 
> Should we store these configs under the device's "name"? that can't change, right?
> 
> -----
> 
> smaller: do we want to enable the dock on all displays by default? Or leave it only on the primary by default? If it's on by default, should be pre-initialize that other dock with the default bands? updating to that version, I just got three other top docks that were totally empty

### @michaeljolley — 0 reactions  
`—`  ·  [link](https://github.com/microsoft/PowerToys/pull/46915#issuecomment-4444101247)

> Re: device ID stability —
> 
> You're right, GDI device names (`\\.\DISPLAY1`) are volatile and shuffle on plug/unplug/reboot. Friendly names alone won't work though — two identical monitors (e.g. two `DELL U2723QE`) would collide.
> 
> FancyZones already solved this with a composite identifier (see `FancyZonesDataTypes.h:126-133`):
> - **Hardware device ID** from `EnumDisplayDevices` with `EDD_GET_DEVICE_INTERFACE_NAME` → something like `DISPLAY#GSM1388#4&125707d6&0&UID8388688` (vendor + product + instance, stable per GPU port)
> - **EDID serial number** from WMI `WmiMonitorID.SerialNumberID` → hardware-burned, truly unique per physical unit
> - **Matching**: serial wins when both sides have one; falls back to device ID
> 
> | Identifier | Stable? | Unique? |
> |---|---|---|
> | GDI name (current) | ❌ Volatile | ✅ At runtime |
> | Friendly name | ✅ Stable | ❌ Identical models collide |
> | Hardware device path | ⚠️ Port-tied | ✅ Yes |
> | EDID serial | ✅ Hardware | ⚠️ ~15-20% blank/duplicate |
> | FZ composite (both) | ✅ Best effort | ✅ Best effort |
> 
> We should adopt the FancyZones approach. Going to implement it in this PR.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
