import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { cheerio, parser, traverse } from "./deps.ts";

Deno.test("integration tests", async (t) => {
  const demoDir = dirname(
    new URL(import.meta.resolve("./demo/fresh.gen.ts")).pathname,
  );
  const freshDir = join(demoDir, "_fresh");
  const res = await new Deno.Command("deno", {
    args: ["task", "build"],
    stdout: "inherit",
    stderr: "inherit",
  }).output();
  assert(res.success);

  await t.step("`_fresh/index.html` should be generated", async (t) => {
    const indexHTML = await Deno.readTextFile(join(freshDir, "index.html"));
    const generatedFiles = (await Array.fromAsync(Deno.readDir(freshDir)))
      .filter((x) => x.isFile).map((x) => x.name);
    const generatedJsFiles = generatedFiles.filter((x) => x.endsWith(".js"));
    const $ = cheerio(indexHTML);

    await t.step("`<link>` elements", () => {
      const $links = $("link");
      assert($links.length > 0);
      for (const link of $links) {
        const href = $(link).attr("href");
        assert(href);
        assert(href.startsWith("/"));
        if (href.endsWith(".js")) {
          assert(
            generatedJsFiles.includes(href.slice(1)),
            `'${href}' should be one of ${
              generatedJsFiles.map((x) => `'${x}'`).join(", ")
            }`,
          );
        }
      }
    });

    await t.step("inline `<script>` elements", () => {
      const $scripts = $("script[type=module]");
      assert($scripts.length > 0);
      const $inlineScripts = $scripts.filter((_, x) => $(x).text().length > 0);
      assert($inlineScripts.length === 1);

      const imports = extractImports($inlineScripts.text());
      assert(imports.length > 0);
      for (const specifier of imports) {
        assert(
          typeof specifier === "string",
          `\`${specifier}\` should be a string`,
        );
        assert(
          specifier.startsWith("/"),
          `'${specifier}' should start with '/'`,
        );
        assert(
          generatedJsFiles.includes(specifier.slice(1)),
          `'${specifier}' should be one of ${
            generatedJsFiles.map((x) => `'${x}'`).join(", ")
          }`,
        );
      }
    });
  });
});

function extractImports(source: string): Array<string> {
  const imports: Array<string> = [];
  const ast = parser.parse(source, { sourceType: "module" });
  traverse(ast, {
    // @ts-expect-error TODO: fix this type error
    ImportDeclaration(path) {
      const link = path.node.source.value;
      imports.push(link);
    },
  });
  return imports;
}
