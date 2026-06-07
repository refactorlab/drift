# netdata/netdata #22109 — feat(topology/snmp): SNMP L2/L3 topology engine and collector

**[View PR on GitHub](https://github.com/netdata/netdata/pull/22109)**

| | |
|---|---|
| **Author** | @ktsaou |
| **Status** | ✅ merged |
| **Opened** | 2026-04-01 |
| **Repo importance** | ★79,067 · 6,456 forks · score 109,889 |
| **Diff** | +44783 / −127 across 272 files |
| **Engagement** | 28 conversation · 129 inline review comments |

## Top review comments (ranked by reactions)

### @ktsaou — 1 reactions  
`👍 1`  ·  [link](https://github.com/netdata/netdata/pull/22109#issuecomment-4263033088)

> @ilyam8 I committed a change required for the UI to optimize big presentations.

### @ktsaou — 0 reactions  
`—`  ·  [link](https://github.com/netdata/netdata/pull/22109#issuecomment-4181934420)

> @ilyam8 please take over. I finished on this.

### @ktsaou — 0 reactions  
`—`  ·  [link](https://github.com/netdata/netdata/pull/22109#issuecomment-4188813481)

> @ilyam8 I separated the testfiles and run PR reviews until nothing more could be found.

### @ktsaou — 0 reactions  
`—`  ·  [link](https://github.com/netdata/netdata/pull/22109#issuecomment-4277066184)

> Follow-up on the topology regression for non-declarative vendor profiles.
> 
> I kept the new declarative `snmp_topology` design from `ilyam8` and fixed the gap by adding topology mixin `extends:` entries to the affected vendor profiles instead of restoring the old autoprobe path.
> 
> Changes in `c3512d3ded68416dd869dc48bc80797fc6cc3bb6`:
> - add `_std-lldp-mib.yaml`, `_std-topology-fdb-arp-mib.yaml`, `_std-topology-q-bridge-mib.yaml`, `_std-topology-stp-mib.yaml` to `mikrotik-router.yaml`
> - add the same topology mixins to `zyxel-switch.yaml`
> - add the same topology mixins to `dlink-dgs-switch.yaml`
> - extend `snmp_topology/topology_profiles_test.go` to assert declarative topology coverage for MikroTik, Zyxel, and D-Link
> 
> This keeps the intended declarative model intact while restoring L2 topology collection for those vendors.
> 
> Validation:
> - `go test ./plugin/go.d/collector/snmp_topology -run TestFindProfiles_UsesDeclarativeTopologyExtensions -count=1`
> - `go test ./plugin/go.d/collector/snmp_topology/... -count=1`
> - `go test ./plugin/go.d/collector/snmp/... -count=1`


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
