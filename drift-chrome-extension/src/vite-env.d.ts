/// <reference types="vite/client" />
/// <reference types="chrome" />

// Distribution-profile flag injected at build time via Vite `define` (see
// vite.config.ts / vitest.config.ts). `true` in the Chrome Web Store build,
// `false` everywhere else. Used to dead-code-eliminate the remote-scanner
// download path out of the store package.
declare const __DRIFT_STORE_BUILD__: boolean;

// File System Access API — `showSaveFilePicker` + its option types are not yet
// in this TypeScript release's lib.dom (the handle/writable-stream interfaces
// ARE). We declare only the missing entrypoint so `core/saveFile.ts` can use the
// native save picker; see that module for why it's the preferred export path.
interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string | string[]>;
}
interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: FilePickerAcceptType[];
  excludeAcceptAllOption?: boolean;
  id?: string;
  startIn?: FileSystemHandle | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
}
interface Window {
  showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
}
