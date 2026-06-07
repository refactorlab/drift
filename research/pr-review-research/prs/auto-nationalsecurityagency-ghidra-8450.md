# NationalSecurityAgency/ghidra #8450 — Fixed ida plugin working in IDA 9.x

**[View PR on GitHub](https://github.com/NationalSecurityAgency/ghidra/pull/8450)**

| | |
|---|---|
| **Author** | @ZERO-A-ONE |
| **Status** | ✅ merged |
| **Opened** | 2025-08-20 |
| **Repo importance** | ★69,249 · 7,612 forks · score 104,682 |
| **Diff** | +24 / −28 across 4 files |
| **Engagement** | 16 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @Der-Systemfehler — 1 reactions  
`👍 1`  ·  [link](https://github.com/NationalSecurityAgency/ghidra/pull/8450#issuecomment-3205732328)

> I might be able to test this in a few hours. I ran into this problem just yesterday so stumbled upon this fix. 
> The last PR didn't work ( I assume because of the missing files) but I couldn't test this one yet.

### @ZERO-A-ONE — 1 reactions  
`🎉 1`  ·  [link](https://github.com/NationalSecurityAgency/ghidra/pull/8450#issuecomment-3206805666)

> > Thank you for fixing! The fix helped with proper error handling, the nonetype seems to remain:
> > 
> > ```
> > 
> > Python 3.10.5 (tags/v3.10.5:f377153, Jun  6 2022, 16:14:13) [MSC v.1929 64 bit (AMD64)] 
> > IDAPython 64-bit v9.1.0 (c) The IDAPython Team <idapython@googlegroups.com>
> > -----------------------------------------------------------------------------------------
> > 
> > XML Exporter v5.0.2 : SDK 910 : Python : Aug 20 2025 15:22:57
> > 
> > -----------------------------------------------------------
> > Exporting XML <PROGRAM> document ....
> > Processing PROGRAM                 CPU time: 0.0886
> > Processing DATATYPES               CPU time: 0.3353
> > Processing MEMORY_MAP              CPU time: 116.4273
> > Processing REGISTER_VALUES         CPU time: 0.0912
> > Processing CODE                    CPU time: 12.7872
> > Processing DATA                    CPU time: 62.0138
> > Processing COMMENTS                CPU time: 28.5164
> > Processing BOOKMARKS               CPU time: 0.0467
> > Processing PROGRAM_ENTRY_POINTS    CPU time: 0.0006
> > Processing SYMBOL_TABLE            CPU time: 12.4177
> > Processing FUNCTIONS               CPU time: 15.8783
> > Processing MARKUP                  
> > ***** Exception occurred: XML Exporter failed! *****
> >  TypeError: %X format: an integer is required, not NoneType
> > ```
> > 
> > Unfortunately I'm not very experienced and more or less stumpled upon this, so if theres anything more I can do please feel free to tell me
> 
> I've updated idaxml.py again. Specifically, I added a None value check at the beginning of the write_numeric_attribute function. If it's convenient fo … *[truncated]*

### @ryanmkurtz — 0 reactions  
`—`  ·  [link](https://github.com/NationalSecurityAgency/ghidra/pull/8450#issuecomment-3205069820)

> Are there differences between this PR and the other one you closed?

### @ZERO-A-ONE — 0 reactions  
`—`  ·  [link](https://github.com/NationalSecurityAgency/ghidra/pull/8450#issuecomment-3205096777)

> > Are there differences between this PR and the other one you closed?
> 
> There is a difference: the one previously closed only submitted the fix for ida_typeinf in idaxml.py, but did not submit the patch for exceptions in other ida plugins.

### @ryanmkurtz — 0 reactions  
`—`  ·  [link](https://github.com/NationalSecurityAgency/ghidra/pull/8450#issuecomment-3205322884)

> Thanks. Do you feel pretty confident with your testing?  We don't have the ability to actually run this to verify correctness.

### @Der-Systemfehler — 0 reactions  
`—`  ·  [link](https://github.com/NationalSecurityAgency/ghidra/pull/8450#issuecomment-3206692432)

> Tried to export with the changes.  Unfortunately got an error message, although it was significantly improved over the previous lambda one:
> ```
> 
> Failed while executing plugin_t.run():
> Traceback (most recent call last):
>   File "C:/Program Files/IDA Professional 9.1/plugins/xml_exporter.py", line 72, in run
>     xml.export_xml()
>   File "C:\Program Files\IDA Professional 9.1\python\idaxml.py", line 415, in export_xml
>     self.export_markup()
>   File "C:\Program Files\IDA Professional 9.1\python\idaxml.py", line 1145, in export_markup
>     self.export_enum_references(addr)
>   File "C:\Program Files\IDA Professional 9.1\python\idaxml.py", line 964, in export_enum_references
>     self.export_enum_reference(addr, op)
>   File "C:\Program Files\IDA Professional 9.1\python\idaxml.py", line 945, in export_enum_reference
>     self.write_numeric_attribute(VALUE, idc.get_enum_member_value(cid))
>   File "C:\Program Files\IDA Professional 9.1\python\idaxml.py", line 2215, in write_numeric_attribute
>     temp = "0x%X" % value
> TypeError: %X format: an integer is required, not NoneType
> 
> During handling of the above exception, another exception occurred:
> 
> Traceback (most recent call last):
>   File "C:/Program Files/IDA Professional 9.1/plugins/xml_exporter.py", line 81, in run
>     print(f"\n{msg}\n {type(e).__name__}: {e}")
> NameError: name 'e' is not defined
> ```


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
