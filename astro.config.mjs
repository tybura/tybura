import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://www.tybura.com",
  integrations: [
    sitemap({
      // /junk/print is noindex, keep it out of the sitemap
      filter: (page) => !page.includes("/junk/print"),
    }),
  ],
});
