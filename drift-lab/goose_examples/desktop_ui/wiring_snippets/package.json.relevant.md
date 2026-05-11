# Relevant `package.json` dependencies for the local-inference UI

Below is the **subset of `ui/desktop/package.json`** actually used by the
copied components in `goose_examples/desktop_ui/`. Anything not on this list
the copied files don't import.

The full upstream `package.json` is at [`ui/desktop/package.json`](../../../ui/desktop/package.json).

---

## Runtime dependencies

```jsonc
{
  "dependencies": {
    // === Core React (must match ≥18 — components use hooks, no class comps) ===
    "react": "^19.2.4",
    "react-dom": "^19.2.4",

    // === Icon set used throughout localInference/* ===
    "lucide-react": "^0.575.0",
    //   Icons referenced: Download, Trash2, X, ChevronDown, ChevronUp,
    //                     Settings2, Eye, RotateCcw, HardDrive, Search,
    //                     ChevronRight, ChevronLeft, etc.

    // === i18n (react-intl + formatjs) ===
    "react-intl": "^10.1.0",
    //   The components import `defineMessages` and `useIntl` via the project
    //   helper at `src/i18n` — see the `i18n.ts` re-export pattern in goose.

    // === Generated API SDK (HTTP fetch client for /local-inference/*) ===
    //   The SDK itself is generated at build time, but the runtime depends
    //   on @hey-api/client-fetch from devDependencies. No extra runtime dep.

    // === Optional but recommended ===
    "swr": "^2.4.0",          // if you want to switch from manual fetching to SWR
    "react-toastify": "^11.0.5"  // for download-failure toasts (optional)
  }
}
```

## Dev dependencies (codegen + UI primitives)

```jsonc
{
  "devDependencies": {
    // === API codegen — drives `pnpm run generate-api` ===
    "@hey-api/openapi-ts": "^0.93.0",
    //   Reads ./openapi.json, writes ./src/api/{sdk.gen.ts,types.gen.ts}

    // === Headless UI primitives — used by Button, Switch, Dialog ===
    //   These are part of goose's own UI kit at src/components/ui/.
    //   You don't strictly need Radix to make this work, but the copied
    //   files import these wrappers:
    "@radix-ui/react-dialog": "^1.1.15",      // ModalSettingsPanel modal
    "@radix-ui/react-popover": "^1.1.15",     // Hover panels
    "@radix-ui/react-scroll-area": "^1.2.10", // Long lists
    "@radix-ui/react-tabs": "^1.1.13",        // Settings tabs
    //
    //   If you don't already have @radix-ui in your stack, you can replace
    //   each <Dialog>, <Switch>, <Button>, etc. with native HTML — see the
    //   "Adapt the UI primitives" step in the plan.
  }
}
```

## What you DON'T need from the upstream package.json

The full goose desktop app pulls in ~80 packages. Most are unrelated to local
inference:

- `@aaif/goose-sdk`, `@modelcontextprotocol/sdk`, `@mcp-ui/client` — MCP
  protocol, only relevant if you want the agent/tools UI
- `electron`, `electron-forge`, `electron-log`, etc. — Electron host shell;
  goose runs as a desktop app but the local-inference UI itself is plain React
- `framer-motion`, `react-syntax-highlighter`, `katex`, `remark-*` — chat UI
  rendering, unrelated to local-inference
- `playwright`, `vitest`, `eslint`, `prettier`, `tailwindcss` — your own
  toolchain choices

## Summary

The minimum viable port needs **5 packages** at runtime:
`react`, `react-dom`, `lucide-react`, `react-intl`, plus a fetch-based HTTP
client (the @hey-api one is auto-generated, or you can write your own
`fetch()` calls against the same routes).
