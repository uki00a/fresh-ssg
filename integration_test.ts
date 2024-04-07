import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { cheerio } from "./deps.ts";

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

  await t.step("`_fresh/index.html should` be generated", async () => {
    const indexHTML = await Deno.readTextFile(join(freshDir, "index.html"));
    const $ = cheerio(indexHTML);
    const $links = $("link");
    assert($links.length > 0);
    for (const link of $links) {
      const href = $(link).attr("href");
      assert(href);
      assert(href.startsWith("/"));
      assert(
        !href.startsWith("/_frsh/js/"),
        `'${href}' should not start with '/_frsh/js/'`,
      );
    }
  });
});
