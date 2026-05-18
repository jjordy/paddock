/**
 * Read a JSON file from `data/`. Used by page loaders, which always run
 * server-side (dev SSR + build-time SSG) — never in the client bundle,
 * since loader bodies are stripped by rogue's strip transform.
 *
 * The `node:fs` / `node:path` imports are *dynamic* — Vite would
 * externalize the static form into the client bundle (Rollup pulls
 * the file in to honor the surviving `import { loadJson }` line in
 * the page module before tree-shaking can remove it). Dynamic imports
 * are kept as runtime expressions and never fire on the client because
 * `loadJson` itself is dead code there.
 *
 * Path is resolved relative to process.cwd(), which is the repo root in
 * every execution path (`pnpm run dev`, `pnpm run build`, the SSG walker).
 */
export async function loadJson<T = unknown>(relativePath: string): Promise<T> {
  const [{ readFile }, { join }] = await Promise.all([
    import('node:fs/promises'),
    import('node:path'),
  ])
  const full = join(process.cwd(), relativePath)
  const text = await readFile(full, 'utf8')
  return JSON.parse(text) as T
}
