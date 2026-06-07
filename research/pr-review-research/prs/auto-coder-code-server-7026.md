# coder/code-server #7026 — Update Code to 1.94.0

**[View PR on GitHub](https://github.com/coder/code-server/pull/7026)**

| | |
|---|---|
| **Author** | @benz0li |
| **Status** | ✅ merged |
| **Opened** | 2024-10-04 |
| **Repo importance** | ★77,831 · 6,688 forks · score 109,572 |
| **Diff** | +12536 / −7475 across 67 files |
| **Engagement** | 18 conversation · 1 inline review comments |

## Top review comments (ranked by reactions)

### @code-asher — 3 reactions  
`👍 2 · ❤️ 1`  ·  [link](https://github.com/coder/code-server/pull/7026#issuecomment-2415739769)

> The entrypoint having been rewritten in ESM is making things really difficult, I started converting us to ESM but it is a nightmare.
> 
> Think tomorrow I am going to break out VS Code into a separate process and communicate via IPC rather than importing it directly in the same process, should completely isolate us from any changes VS Code makes like this, and is the way it really should have been done in the first place.

### @benz0li — 1 reactions  
`👍 1`  ·  [link](https://github.com/coder/code-server/pull/7026#issuecomment-2392835053)

> Notes:
> 
> ```diff
> --- lib/vscode/src/vs/platform/extensionManagement/node/extensionDownloader.ts
> +++ lib/vscode/src/vs/platform/extensionManagement/node/extensionDownloader.ts
> @@ -114,7 +114,10 @@ export class ExtensionsDownloader extend
>  			return false;
>  		}
>  
> +		return false
> +		// @ts-expect-error
>  		const value = this.configurationService.getValue('extensions.verifySignature');
> +		// @ts-expect-error
>  		return isBoolean(value) ? value : true;
>  	}
> ```
> 
> 👉 Code does not exist any more
> 
> ---
> 
> ```diff
> --- lib/vscode/src/vs/workbench/contrib/remote/browser/remoteExplorer.ts
> +++ lib/vscode/src/vs/workbench/contrib/remote/browser/remoteExplorer.ts
> @@ -77,7 +77,7 @@ export class ForwardedPortsView extends
>  	private async enableForwardedPortsView() {
>  		this.contextKeyListener.clear();
>  
> -		const viewEnabled: boolean = !!forwardedPortsViewEnabled.getValue(this.contextKeyService);
> +		const viewEnabled: boolean = true;
>  
>  		if (viewEnabled) {
>  			const viewContainer = await this.getViewContainer();
> ```
> 
> ℹ️ Also `const featuresEnabled: boolean = true;`
> 
> ---
> 
> ```diff
> --- lib/vscode/src/vs/workbench/workbench.web.main.ts
> +++ lib/vscode/src/vs/workbench/workbench.web.main.ts
> @@ -52,7 +52,7 @@ import 'vs/workbench/services/dialogs/br
>  import 'vs/workbench/services/host/browser/browserHostService';
>  import 'vs/workbench/services/lifecycle/browser/lifecycleService';
>  import 'vs/workbench/services/clipboard/browser/clipboardService';
> -import 'vs/workbench/services/localization/browser/localeService';
> +import 'vs/workbench/services/localization/electron-sandbox/localeService';
>  import 'vs/wor … *[truncated]*

### @benz0li — 1 reactions  
`👍 1`  ·  [link](https://github.com/coder/code-server/pull/7026#issuecomment-2392836186)

> @code-asher Please review and migrate the CI from `yarn` to `npm`.
> 
> Thank you.
> 
> Cross reference:
> 
> * https://gitlab.b-data.ch/coder/code-server-builder/-/commit/e8f0e513a2053cd26e0749e6a3a9271008b4f389

### @benz0li — 1 reactions  
`👀 1`  ·  [link](https://github.com/coder/code-server/pull/7026#issuecomment-2392876381)

> @code-asher `npm run build:vscode` runs into the following error:
> 
> ```
> [hh:mm:ss] Error: /home/benz0li/projects/coder/code-server/lib/vscode/src/vs/platform/telemetry/test/browser/telemetryService.test.ts(20,31): Argument of type 'sinon.SinonStatic' is not assignable to parameter of type 'import("/home/benz0li/projects/coder/code-server/lib/vscode/node_modules/@types/sinon-test/node_modules/@types/sinon/index").SinonStatic'.
>   Type 'SinonStatic' is not assignable to type 'SinonSandbox'.                                                         
>     The types of 'usingPromise(...).replace' are incompatible between these types.                                     
>       Property 'usingAccessor' is missing in type '<T, TKey extends keyof T, R extends T[TKey] = T[TKey]>(obj: T, prop: TKey, replacement: R) => R' but required in type 'SandboxReplace'.                                                    
> [hh:mm:ss] Finished compilation with 1 errors after 3057276 ms
> [hh:mm:ss] Error: /home/benz0li/projects/coder/code-server/lib/vscode/src/vs/platform/telemetry/test/browser/telemetryService.test.ts(20,31): Argument of type 'sinon.SinonStatic' is not assignable to parameter of type 'import("/home/benz0li/projects/coder/code-server/lib/vscode/node_modules/@types/sinon-test/node_modules/@types/sinon/index").SinonStatic'.
>   Type 'SinonStatic' is not assignable to type 'SinonSandbox'.                                                         
>     The types of 'usingPromise(...).replace' are incompatible between these types.                                     
>       Property 'usingAccessor' … *[truncated]*

### @code-asher — 1 reactions  
`🎉 1`  ·  [link](https://github.com/coder/code-server/pull/7026#issuecomment-2394308224)

> VS Code switched to npm??  Great news.  I will try to get to this today.

### @benz0li — 1 reactions  
`👍 1`  ·  [link](https://github.com/coder/code-server/pull/7026#issuecomment-2400529545)

> @code-asher `Code - OSS` v1.94.1 was released today: https://github.com/microsoft/vscode/releases/tag/1.94.1


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
