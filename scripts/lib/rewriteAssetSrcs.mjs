/**
 * Rewrites local `/images/*` and `/fonts/*` asset references in compiled MDX
 * to the production CDN base. In production the Lambda does not serve these
 * paths (they're on S3/CloudFront), so leaving them relative breaks images.
 *
 * Extracted from compile-mdx.mjs so it can be unit-tested as a regression guard.
 */

/**
 * Derive the CDN base from environment, stripping a trailing slash and a
 * trailing `/images` segment (callers append `/images/...` themselves).
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {string} CDN base without trailing slash, or '' when unset.
 */
export function computeCdnBase(env = process.env) {
  return (env.VITE_CDN_URL || env.CDN_URL || '')
    .replace(/\/$/, '')
    .replace(/\/images$/, '');
}

/**
 * Rewrite `src:"/images/..."` and `src:"/fonts/..."` in bundled MDX/JSX output
 * to `src:"<cdnBase>/images/..."`. Absolute URLs and other paths are untouched.
 *
 * @param {string} code - bundled MDX output.
 * @param {string} cdnBase - CDN base (no trailing slash); '' disables rewriting.
 * @returns {string}
 */
export function rewriteAssetSrcs(code, cdnBase) {
  if (!cdnBase) return code;
  return code.replace(/src:"\/(images|fonts)\//g, `src:"${cdnBase}/$1/`);
}
