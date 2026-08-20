import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const products = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/products" }),
  schema: z.object({
    name: z.string(),
    tagline: z.string(),
    oneLiner: z.string(),
    category: z.string(),
    status: z.enum(["building", "launching", "live", "archived"]),
    order: z.number(),
    color: z.string(),
    url: z.string().url().optional(),
    appStoreUrl: z.string().url().optional(),
    playStoreUrl: z.string().url().optional(),
    launchDate: z.string().optional(),
    heroImage: z.string().optional(),
    screenshots: z.array(z.string()).default([]),
    sections: z
      .array(
        z.object({
          heading: z.string(),
          body: z.string(),
        })
      )
      .default([]),
  }),
});

const notes = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/notes" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    excerpt: z.string(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { products, notes };
