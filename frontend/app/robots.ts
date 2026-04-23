import { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://interviewwithfriday.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // Standard crawlers + AI search engines (Perplexity, ChatGPT, Gemini, Claude)
        userAgent: "*",
        allow: ["/"],
        disallow: ["/interview/", "/report/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
