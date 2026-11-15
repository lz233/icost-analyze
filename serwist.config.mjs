import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { serwist } from "@serwist/next/config";

const offline = readFileSync("public/offline.html");

export default serwist({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  globIgnores: ["public/offline.html"],
  additionalPrecacheEntries: [
    {
      url: "/offline.html",
      revision: createHash("md5").update(offline).digest("hex"),
    },
  ],
  globPatterns: [
    ".next/static/**/*.{js,css,woff,woff2,ttf,otf,html,ico,png,svg,webp,json,webmanifest}",
    "public/**/*.{html,webmanifest,png,svg,ico,js,css,woff,woff2}",
  ],
});
