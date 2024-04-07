import { basename, dirname, extname } from "node:path";
import { isDynamicRoute } from "$fresh-ssg/_utils.ts";
import type { Manifest } from "$fresh/server.ts";
import {
  cheerio,
  generate as babelGenerate,
  parser,
  traverse,
} from "./deps.ts";

export interface Storage {
  write(path: string, content: string): Promise<void>;
}

export interface GenerateOptions {
  logger: Logger;
  storage: Storage;
  handler: (request: Request) => Promise<Response>;
  manifest: Manifest;
  routes?: Array<string>;
  ignore?: Array<string>;
}

interface Logger {
  info(message: string): void;
}

export async function generate(options: GenerateOptions) {
  const routes = collectRoutes(options);
  const { logger } = options;
  for (const route of routes) {
    if (!isProcessableRoute(route)) {
      log(logger, "info", `'${route.requestPath}' is skipped`);
      continue;
    }
    log(logger, "info", `Processing '${route.requestPath}'...`);
    const request = new Request(
      new URL(route.requestPath, "http://localhost:8000"),
    );
    const response = await options.handler(request);
    const html = await response.text();
    await options.storage.write(route.filePath, rewriteLinks(html));
  }
}

/**
 * ```javascript
 * `/_frsh/js/${buildHash}/${script}.js`
 * ```
 */
const kFreshJsLinkPath = "/_frsh/js/";
function stripFreshJsPathPrefix(path: string): string {
  assert(path.startsWith(kFreshJsLinkPath));
  const pathWithHash = path.slice(kFreshJsLinkPath.length);
  const endOfHash = pathWithHash.indexOf("/");
  assert(endOfHash > -1);
  return pathWithHash.slice(endOfHash);
}

export function rewriteLinks(html: string): string {
  const $ = cheerio(html);
  $("link").each((_, link) => {
    const $link = $(link);
    const href = $link.attr("href");
    if (href?.startsWith(kFreshJsLinkPath)) {
      $link.attr("href", stripFreshJsPathPrefix(href));
    }
  });
  function transformScript(source: string): string {
    const ast = parser.parse(source, { sourceType: "module" });
    traverse(ast, {
      // @ts-expect-error TODO: fix this type error
      ImportDeclaration(path) {
        const link = path.node.source.value;
        if (link.startsWith(kFreshJsLinkPath)) {
          path.node.source.value = stripFreshJsPathPrefix(link);
        }
      },
    });
    const { code } = babelGenerate(ast, {});
    return code;
  }
  $("script[type=module]").each((_, script) => {
    const $script = $(script);
    const source = $script.text();
    $script.text(transformScript(source));
  });
  return $.html();
}

function log(logger: Logger, level: keyof Logger, message: string): void {
  return logger[level](`[fresh-ssg] ${message}`);
}

function isProcessableRoute(route: Route): boolean {
  return !route.isDynamic && Boolean(route.isRenderable);
}

interface Route {
  filePath: string;
  requestPath: string;
  isDynamic?: boolean;
  isRenderable?: boolean;
}

function collectRoutes(options: GenerateOptions): Array<Route> {
  return [
    ...(options.manifest ? collectRoutesFromManifest(options.manifest) : []),
    ...(options.routes?.map((requestPath) => {
      const filePath = `${requestPath}.html`;
      return {
        requestPath,
        filePath,
      };
    }) ?? []),
  ];
}

const kManifestRoutePrefix = "./routes";
function collectRoutesFromManifest(manifest: Manifest): Array<Route> {
  const renderableExtensions = [".tsx", ".jsx"];
  const templateRoutes = ["_app", "_layout"];
  return Object.keys(manifest.routes).map((routePath) => {
    assert(
      routePath.startsWith(kManifestRoutePrefix),
      `'${routePath}' should start with '${kManifestRoutePrefix}'`,
    );
    const normalizedRoutePath = routePath.slice(kManifestRoutePrefix.length);
    assert(normalizedRoutePath.startsWith("/"));
    const extension = extname(normalizedRoutePath);
    const isDynamic = isDynamicRoute(normalizedRoutePath);
    const isRenderable = renderableExtensions.includes(extension) &&
      !templateRoutes.includes(basename(normalizedRoutePath, extension));
    const normalizedRoutePathWithoutExtension = normalizedRoutePath.slice(
      0,
      -extension.length,
    );
    const requestPath = normalizedRoutePathWithoutExtension.endsWith("/index")
      ? dirname(normalizedRoutePathWithoutExtension)
      : normalizedRoutePathWithoutExtension;
    const filePath = `${normalizedRoutePathWithoutExtension}.html`;
    return {
      requestPath,
      filePath,
      isDynamic,
      isRenderable,
    };
  });
}

function assert(expr: boolean, message = "Assertion failed"): asserts expr {
  if (!expr) {
    throw new Error("[fresh-ssg] " + message);
  }
}
