import { appendFileSync, readFileSync } from 'node:fs';

export function getInput(name: string, fallback = ''): string {
  const v = process.env[name];
  return v == null || v === '' ? fallback : v;
}

export function setOutput(name: string, value: string): void {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) {
    info(`::set-output name=${name}::${value}`);
    return;
  }
  appendFileSync(file, `${name}<<__DRIFT_EOF__\n${value}\n__DRIFT_EOF__\n`);
}

export function setFailed(message: string): void {
  process.exitCode = 1;
  process.stderr.write(`::error::${message}\n`);
}

export function info(message: string): void {
  process.stdout.write(`${message}\n`);
}

export function getEvent(): any {
  const path = process.env.GITHUB_EVENT_PATH;
  if (!path) throw new Error('GITHUB_EVENT_PATH is not set');
  return JSON.parse(readFileSync(path, 'utf8'));
}
