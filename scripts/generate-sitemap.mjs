import { readdir } from "fs/promises";
import { writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_URL = "https://echlhq.com";

const TEAM_IDS = [
  74, 66, 10, 107, 5, 8, 60, 108, 52, 11, 65, 98, 79, 53, 56,
  101, 63, 13, 85, 55, 97, 50, 109, 70, 103, 72, 106, 61, 96, 104,
];

async function generateSitemap() {
  const urls = [];
  const today = new Date().toISOString().split("T")[0];

  // Static pages
  for (const path of ["/", "/standings", "/leaders", "/attendance"]) {
    urls.push({ loc: `${SITE_URL}${path}`, changefreq: "daily", priority: path === "/" ? "1.0" : "0.8" });
  }

  // Team pages
  for (const id of TEAM_IDS) {
    urls.push({ loc: `${SITE_URL}/team/${id}`, changefreq: "daily", priority: "0.7" });
  }

  // Box score pages
  const boxscoreDir = join(__dirname, "..", "client", "public", "data", "boxscores");
  try {
    const files = await readdir(boxscoreDir);
    for (const file of files) {
      if (file.endsWith(".json")) {
        const gameId = file.replace(".json", "");
        urls.push({ loc: `${SITE_URL}/game/${gameId}`, changefreq: "never", priority: "0.5" });
      }
    }
  } catch {
    console.warn("No boxscores directory found, skipping game URLs");
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

  const outPath = join(__dirname, "..", "client", "public", "sitemap.xml");
  await writeFile(outPath, xml, "utf-8");
  console.log(`Sitemap written to ${outPath} (${urls.length} URLs)`);
}

generateSitemap().catch(console.error);
