import type { GenerateOptions, Storage } from "./_ssg.ts";
import { generate } from "./_ssg.ts";

import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";

import {
  createHandler,
  type Plugin,
  type ResolvedFreshConfig,
} from "$fresh/server.ts";

type Options = Omit<GenerateOptions, "logger" | "storage" | "handler">;
export function ssg(options: Options): Plugin {
  let config: ResolvedFreshConfig | undefined;
  const plugin: Plugin = {
    name: "fresh_ssg",
    async buildEnd() {
      if (config == null) {
        throw new Error("[fresh-ssg] `config` is required");
      }
      await generate({
        ...options,
        handler: await createHandler(options.manifest, config),
        storage: createFsStorage(config.build.outDir),
        logger: console,
      });
    },
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
  };

  return plugin;
}

function createFsStorage(baseDir: string): Storage {
  const seenDirs = new Set<string>();
  return { write };

  async function write(path: string, content: string): Promise<void> {
    const normalizedPath = join(baseDir, path);
    const dir = dirname(normalizedPath);
    if (!seenDirs.has(dir)) {
      seenDirs.add(dir);
      await mkdir(dir, { recursive: true });
    }
    await Deno.writeTextFile(normalizedPath, content);
  }
}
