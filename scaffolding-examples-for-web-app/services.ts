import { Hono } from 'hono';
import { jwt } from 'hono/jwt'
import { SECRET } from './auth.ts'
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CURRENT_FOLDER = path.resolve(__dirname);

function getAllCurrentFolderNames() {
  const currentDir = CURRENT_FOLDER;
  const folders: string[] = [];
  for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      // Optional: Add filters to exclude certain directories, e.g., if (entry.name !== 'node_modules' && !entry.name.startsWith('.'))
      folders.push(entry.name);
    }
  }
  return folders;
}
const services = new Hono();
services.use(
  '/*',
  jwt({
    secret: SECRET
  })
)
const folders = getAllCurrentFolderNames();
for (const folder of folders) {
  try {
    const mod = await import(`./${folder}/${folder}.ts`);
    services.route(`/${folder}`, mod.default);
  } catch (e) {
    console.error(`Failed to load route for folder '${folder}':`, e);
  }
}




export { services }