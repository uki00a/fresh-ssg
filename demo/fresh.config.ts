import { defineConfig } from "$fresh/server.ts";
import twind from "$fresh/plugins/twindv1.ts";
import twindConfig from "./twind.config.ts";
import { ssg } from "$fresh-ssg/plugin.ts";
import manifest from "./fresh.gen.ts";

export default defineConfig({
  plugins: [
    twind(twindConfig),
    ssg({ manifest }),
  ],
});
