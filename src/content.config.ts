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

const junk = defineCollection({
  loader: glob({ pattern: "*.json", base: "./src/content/junk" }),
  schema: z.object({
    title: z.string().default(""),
    date: z.string(), // ISO date
    image: z.string(), // /junk/<slug>.webp
    thumb: z.string(), // /junk/<slug>-thumb.webp
    width: z.number(),
    height: z.number(),
    color: z.string().optional(), // dominant color, #rrggbb
    category: z.string().optional(), // auto-detected at ingest
  }),
});

export const collections = { projects, junk };
