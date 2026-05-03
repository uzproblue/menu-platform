/** Data URLs and blob URLs cannot be passed through the default image optimizer. */
export function imageSrcIsNonOptimizable(src: string): boolean {
  const s = src.trim();
  return s.startsWith("data:") || s.startsWith("blob:");
}
