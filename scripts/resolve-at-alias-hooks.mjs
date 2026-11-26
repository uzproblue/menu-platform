import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();

/** Resolve Next-style `@/` imports for node:test. */
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const absolute = path.join(root, specifier.slice(2));
    return nextResolve(pathToFileURL(`${absolute}.ts`).href, context);
  }
  return nextResolve(specifier, context);
}
