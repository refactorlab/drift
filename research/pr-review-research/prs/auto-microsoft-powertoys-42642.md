# microsoft/PowerToys #42642 — Introduce new utility PowerDisplay to control your monitor settings

**[View PR on GitHub](https://github.com/microsoft/PowerToys/pull/42642)**

| | |
|---|---|
| **Author** | @moooyo |
| **Status** | ✅ merged |
| **Opened** | 2025-10-20 |
| **Repo importance** | ★133,794 · 8,036 forks · score 170,937 |
| **Diff** | +20738 / −165 across 181 files |
| **Engagement** | 81 conversation · 151 inline review comments |

## Top review comments (ranked by reactions)

### @niels9001 — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/microsoft/PowerToys/pull/42642#issuecomment-4087882359)

> > @vanzue and @yeelam-gordon @zateutsch   Version 0.98 has been released but I cannot see the Powerdisplay details in Release notes, but I can see the powerdisplay commit include in this release tag 0.98.
> > https://github.com/microsoft/PowerToys/releases/tag/v0.98.0
> 
> Hi @nrv-96, we are planning to introduce PowerDisplay in the 0.99 release.. stay tuned!

### @moooyo — 1 reactions  
`👍 1`  ·  [link](https://github.com/microsoft/PowerToys/pull/42642#issuecomment-3574415450)

> > > Is there a chance for software-based turning on/off monitors and changing inputs?
> > 
> > Theoretically, it is possible. This is because some of our hardware modifications are based on Windows events, and anyone can trigger this event. But I think is not in priority at that time.
> 
> Clarify:
> Every monitor changes from PT settings-ui currently based on Windows Event. So, if we want to implement it, we need to add them in PowerDisplay Settings first.

### @nrv-96 — 1 reactions  
`👍 1`  ·  [link](https://github.com/microsoft/PowerToys/pull/42642#issuecomment-3610385582)

> > Is there a chance for software-based turning on/off monitors and changing inputs?
> 
> Yes, we can turn on/off and change inputs using below repo:
> https://github.com/newAM/monitorcontrol
> 
> Currently, I'm using this app and it's works as expected. 
> ```
> My windows OS Version: 
> OS Name:	Microsoft Windows 11 Pro
> Version:	10.0.26200 Build 26200
> ```
> 
> Here is the command line for your reference:
> ```
> C:\Users\Administrator>monitorcontrol
> usage: monitorcontrol [-h] [--verbose]
>                       (--set-luminance SET_LUMINANCE | --get-luminance | --get-power-mode | --set-power-mode {on,standby,suspend,off_soft,off_hard} | --version | --get-input-source | --set-input-source {OFF,ANALOG1,ANALOG2,DVI1,DVI2,COMPOSITE1,COMPOSITE2,SVIDEO1,SVIDEO2,TUNER1,TUNER2,TUNER3,CMPONENT1,CMPONENT2,CMPONENT3,DP1,DP2,HDMI1,HDMI2} | --get-monitors)
>                       [--monitor MONITOR]
> monitorcontrol: error: one of the arguments --set-luminance --get-luminance --get-power-mode --set-power-mode --version --get-input-source --set-input-source --get-monitors is required
> 
> C:\Users\Administrator>monitorcontrol --get-power-mode
> on
> 
> C:\Users\Administrator>monitorcontrol --get-input-source
> InputSource.HDMI2
> 
> C:\Users\Administrator>monitorcontrol --get-monitors
> Monitor 1: XV240YV
> Available Inputs:
>         InputSource.DP1
>         InputSource.HDMI1
>         InputSource.HDMI2*
> ```
> 
> @eikaramba  Please consider this feature in this powedisplay toy, it would be game changer for all users. Please let me know if you need any other info. 
> 
> cc: @moooyo  @AleksanderGasz @niels9001

### @eikaramba — 1 reactions  
`👍 1`  ·  [link](https://github.com/microsoft/PowerToys/pull/42642#issuecomment-3611137666)

> > > Is there a chance for software-based turning on/off monitors and changing inputs?
> > 
> > Yes, we can turn on/off and change inputs using below repo: https://github.com/newAM/monitorcontrol
> > 
> > Currently, I'm using this app and it's works as expected.
> > 
> > ```
> > My windows OS Version: 
> > OS Name:	Microsoft Windows 11 Pro
> > Version:	10.0.26200 Build 26200
> > ```
> > 
> > Here is the command line for your reference:
> > 
> > ```
> > C:\Users\Administrator>monitorcontrol
> > usage: monitorcontrol [-h] [--verbose]
> >                       (--set-luminance SET_LUMINANCE | --get-luminance | --get-power-mode | --set-power-mode {on,standby,suspend,off_soft,off_hard} | --version | --get-input-source | --set-input-source {OFF,ANALOG1,ANALOG2,DVI1,DVI2,COMPOSITE1,COMPOSITE2,SVIDEO1,SVIDEO2,TUNER1,TUNER2,TUNER3,CMPONENT1,CMPONENT2,CMPONENT3,DP1,DP2,HDMI1,HDMI2} | --get-monitors)
> >                       [--monitor MONITOR]
> > monitorcontrol: error: one of the arguments --set-luminance --get-luminance --get-power-mode --set-power-mode --version --get-input-source --set-input-source --get-monitors is required
> > 
> > C:\Users\Administrator>monitorcontrol --get-power-mode
> > on
> > 
> > C:\Users\Administrator>monitorcontrol --get-input-source
> > InputSource.HDMI2
> > 
> > C:\Users\Administrator>monitorcontrol --get-monitors
> > Monitor 1: XV240YV
> > Available Inputs:
> >         InputSource.DP1
> >         InputSource.HDMI1
> >         InputSource.HDMI2*
> > ```
> > 
> > @eikaramba Please consider this feature in this powedisplay toy, it would be game changer for all users. Please let me know if you need any other info.
> > 
> > cc: … *[truncated]*

### @moooyo — 1 reactions  
`👍 1`  ·  [link](https://github.com/microsoft/PowerToys/pull/42642#issuecomment-3613469050)

> > > Is there a chance for software-based turning on/off monitors and changing inputs?
> > 
> > Yes, we can turn on/off and change inputs using below repo: https://github.com/newAM/monitorcontrol
> > 
> > Currently, I'm using this app and it's works as expected.
> > 
> > ```
> > My windows OS Version: 
> > OS Name:	Microsoft Windows 11 Pro
> > Version:	10.0.26200 Build 26200
> > ```
> > 
> > Here is the command line for your reference:
> > 
> > ```
> > C:\Users\Administrator>monitorcontrol
> > usage: monitorcontrol [-h] [--verbose]
> >                       (--set-luminance SET_LUMINANCE | --get-luminance | --get-power-mode | --set-power-mode {on,standby,suspend,off_soft,off_hard} | --version | --get-input-source | --set-input-source {OFF,ANALOG1,ANALOG2,DVI1,DVI2,COMPOSITE1,COMPOSITE2,SVIDEO1,SVIDEO2,TUNER1,TUNER2,TUNER3,CMPONENT1,CMPONENT2,CMPONENT3,DP1,DP2,HDMI1,HDMI2} | --get-monitors)
> >                       [--monitor MONITOR]
> > monitorcontrol: error: one of the arguments --set-luminance --get-luminance --get-power-mode --set-power-mode --version --get-input-source --set-input-source --get-monitors is required
> > 
> > C:\Users\Administrator>monitorcontrol --get-power-mode
> > on
> > 
> > C:\Users\Administrator>monitorcontrol --get-input-source
> > InputSource.HDMI2
> > 
> > C:\Users\Administrator>monitorcontrol --get-monitors
> > Monitor 1: XV240YV
> > Available Inputs:
> >         InputSource.DP1
> >         InputSource.HDMI1
> >         InputSource.HDMI2*
> > ```
> > 
> > @eikaramba Please consider this feature in this powedisplay toy, it would be game changer for all users. Please let me know if you need any other info.
> > 
> > cc: … *[truncated]*

### @riverar — 0 reactions  
`—`  ·  [link](https://github.com/microsoft/PowerToys/pull/42642#issuecomment-3572557747)

> Just adding https://x.com/SheriefFYI/status/1992983352299925519 to track public usability concerns around this current UI.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
