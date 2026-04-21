/**
 * This committed version is a stub with no embedded assets. The release
 * build overwrites it with real `import ... with { type: "file" }` entries
 * (see scripts/embed-assets.ts) that bake the client bundle into the
 * compiled binary.
 *
 * Do NOT commit a regenerated version — it would turn a trivial file
 * into a large binary diff every time you rebuild. In dev mode, http.ts
 * detects the empty record and serves assets from client/dist/ on disk
 * instead.
 */
export const CLIENT_ASSETS: Record<string, string> = {};
