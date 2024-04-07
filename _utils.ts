import { extname } from "node:path";

export function isDynamicRoute(routePath: string): boolean {
  return removeExtname(routePath).split("/").some((part) =>
    part.startsWith("[") && part.endsWith("]")
  );
}

export function removeExtname(path: string): string {
  const ext = extname(path);
  return removeSuffix(path, ext);
}

function removeSuffix(s: string, suffix: string): string {
  return suffix.length > 0 && s.endsWith(suffix)
    ? s.slice(0, -suffix.length)
    : s;
}
