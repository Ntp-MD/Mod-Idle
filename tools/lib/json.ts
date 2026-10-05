import fs from 'node:fs';

/** Read a JSON file from disk. Used instead of import attributes so the load stays synchronous. */
export function readJson<T = any>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}
