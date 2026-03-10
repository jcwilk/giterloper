#!/usr/bin/env -S deno run -A
/**
 * Fetches Spitfire List FTR articles and extracts main content as markdown.
 * Usage: deno run -A scripts/fetch-spitfire.ts [output-dir]
 */
const URLS = [
  "https://spitfirelist.com/for-the-record/ftr-1090-fascism-2019-world-tour-part-5-destabilizing-china/",
  "https://spitfirelist.com/for-the-record/ftr-1091-the-destabilization-of-china-part-2/",
  "https://spitfirelist.com/for-the-record/ftr-1092-the-destabilization-of-china-part-3/",
  "https://spitfirelist.com/for-the-record/ftr-1093-the-destabilization-of-china-part-4/",
  "https://spitfirelist.com/for-the-record/ftr-1094-the-destabilization-of-china-part-5-pan-turkism-islamism-and-the-earth-island-boogie/",
  "https://spitfirelist.com/for-the-record/ftr-1095-the-destabilization-of-china-part-6-asian-deep-politics/",
  "https://spitfirelist.com/for-the-record/ftr-1143-the-uyghurs-and-the-destabilization-of-china-part-1/",
  "https://spitfirelist.com/for-the-record/ftr-1144-the-uyghurs-and-the-destabilization-of-china-part-2/",
  "https://spitfirelist.com/for-the-record/ftr-1145-the-uyghurs-and-the-destabilization-of-china-part-3/",
  "https://spitfirelist.com/for-the-record/ftr1312-update-on-the-destabilization-of-china-part-1/",
  "https://spitfirelist.com/for-the-record/ftr1313-update-on-the-destabilization-of-china-part-2/",
  "https://spitfirelist.com/for-the-record/ftrs-1178-1179-1180-fascism-and-the-uyghur-genocide-myth-parts-1-2-3/",
  "https://spitfirelist.com/for-the-record/ftr-547-hell-o-dalai/",
  "https://spitfirelist.com/for-the-record/ftr-548-tibet-or-not-tibet/",
  "https://spitfirelist.com/for-the-record/ftr-549-the-pan-turkist-movement-the-underground-reich-and-the-earth-island/",
  "https://spitfirelist.com/for-the-record/ftr-550-going-native/",
];

function slugFromUrl(url: string): string {
  const m = url.match(/\/for-the-record\/([^/]+)\/?$/);
  return m ? m[1].replace(/\//g, "-") : `article-${Date.now()}`;
}

function extractTitle(html: string): string {
  const m = html.match(/<h1[^>]*class="entry-title"[^>]*>([^<]+)<\/h1>/);
  return m ? m[1].trim().replace(/\s+/g, " ") : "Untitled";
}

function extractContent(html: string): string {
  const start = html.indexOf('<div class="entry-content">');
  if (start < 0) return "";
  const end = html.indexOf("</div>", start);
  if (end < 0) return "";
  return html.slice(start, end);
}

function htmlToMarkdown(html: string): string {
  let s = html
    .replace(/<p>\s*<\/p>/g, "\n\n")
    .replace(/<\/p>\s*<p>/g, "\n\n")
    .replace(/<p>/g, "")
    .replace(/<\/p>/g, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<strong>(.*?)<\/strong>/gs, "**$1**")
    .replace(/<em>(.*?)<\/em>/gs, "*$1*")
    .replace(/<b>(.*?)<\/b>/gs, "**$1**")
    .replace(/<i>(.*?)<\/i>/gs, "*$1*")
    .replace(/<h[2-6][^>]*>(.*?)<\/h[2-6]>/gs, (_, t) => `\n## ${t.trim()}\n`)
    .replace(/<a href="([^"]*)"[^>]*>(.*?)<\/a>/gs, (_, href, text) => `[${text.trim()}](${href})`)
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8209;/g, "-")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return s;
}

async function fetchArticle(url: string): Promise<{ title: string; content: string; url: string }> {
  const printUrl = url.endsWith("/") ? `${url}print` : `${url}/print`;
  const res = await fetch(printUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; giterloper-fetch/1.0)" },
  });
  if (!res.ok) {
    const fallback = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; giterloper-fetch/1.0)" },
    });
    if (!fallback.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    const html = await fallback.text();
    const raw = extractContent(html) || html;
    const title = extractTitle(html);
    return { title, content: htmlToMarkdown(raw), url };
  }
  const html = await res.text();
  const raw = extractContent(html);
  const title = extractTitle(html);
  return { title, content: htmlToMarkdown(raw), url };
}

function toMarkdownDoc(article: { title: string; content: string; url: string }): string {
  return `# ${article.title}

Source: [Spitfire List](${article.url})

${article.content}
`;
}

const outDir = Deno.args[0] || "/workspace/.giterloper/spitfire-fetch";
await Deno.mkdir(outDir, { recursive: true });

for (const url of URLS) {
  try {
    const article = await fetchArticle(url);
    const slug = slugFromUrl(url);
    const fname = `${slug}.md`;
    const md = toMarkdownDoc(article);
    await Deno.writeTextFile(`${outDir}/${fname}`, md);
    console.log(`Fetched: ${article.title.substring(0, 60)}...`);
  } catch (e) {
    console.error(`Failed ${url}:`, e);
  }
}

console.log(`\nWrote ${outDir}`);
