import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const projects = defineCollection({
  loader: glob({ pattern: "index.md", base: "./src/content/projects" }),
  schema: z.object({
    projects: z.array(
      z.object({
        name: z.string(),
        type: z.string(),
        location: z.string(),
        year: z.string(),
        status: z.string(),
        url: z.string().optional(),
      })
    ),
  }),
});

export const collections = { projects };
