import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://www.tybura.com",
  integrations: [
    sitemap({
      // /junk/print and /teletext are noindex, keep them out of the sitemap
      filter: (page) => !page.includes("/junk/print") && !page.includes("/teletext"),
    }),
  ],
});
