import { assert } from "./_assert.ts";
import {
  cheerio,
  generate as babelGenerate,
  parser,
  traverse,
} from "./deps.ts";

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

export function rewriteHTML(html: string): string {
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
