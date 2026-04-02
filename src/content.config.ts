import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const projects = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/projects" }),
  schema: z.object({
    title: z.string(),
    subtitle: z.string(),
    order: z.number(),
    liveUrl: z.string().optional(),
    repoUrl: z.string().optional(),
    topologyUrl: z.string().optional(),
    notebookUrl: z.string().optional(),
  }),
});

export const collections = { projects };
