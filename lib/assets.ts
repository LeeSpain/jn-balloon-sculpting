// Resolve a stored image `src` to a usable URL for CSS/`<img>`.
//
// Two kinds of src live in the store:
//   • bundled artwork — a path under /public, e.g. "images/gallery-arch.png"
//   • uploaded photos — stored inline as a data: URL (works on read-only
//     serverless filesystems and appears on the site immediately)
// Absolute URLs and already-rooted paths pass through untouched.
export function assetUrl(src: string): string {
  if (!src) return "";
  if (
    src.startsWith("data:") ||
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("/")
  ) {
    return src;
  }
  return "/" + src;
}
