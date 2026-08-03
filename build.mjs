import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { extname } from "node:path";

const files = [
  "index.html",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
  "sw.js",
  "vercel.json",
  "assets"
];

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });

for (const file of files) {
  await cp(file, `dist/${file}`, { recursive: true });
}

await cp(".openai/hosting.json", "dist/.openai/hosting.json");

const routeFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
  "sw.js",
  "assets/app-icon.svg",
  "assets/ops-map.svg"
];

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

const assets = {};
for (const file of routeFiles) {
  const bytes = await readFile(file);
  assets[`/${file}`] = {
    body: bytes.toString("base64"),
    contentType: contentTypes[extname(file)] || "application/octet-stream"
  };
}
assets["/"] = assets["/index.html"];

const server = `const assets = ${JSON.stringify(assets)};

function responseFor(pathname) {
  const asset = assets[pathname] || assets["/index.html"];
  const bytes = Uint8Array.from(atob(asset.body), char => char.charCodeAt(0));
  return new Response(bytes, {
    headers: {
      "content-type": asset.contentType,
      "cache-control": pathname === "/index.html" || pathname === "/" ? "no-cache" : "public, max-age=31536000"
    }
  });
}

export default {
  fetch(request) {
    const url = new URL(request.url);
    return responseFor(url.pathname);
  }
};
`;

await writeFile("dist/server/index.js", server);
