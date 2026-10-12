import { access, cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { projectRoot as root, standaloneDirectory as standalone } from "./standalone-path.mjs";

await access(path.join(standalone, "server.js"));
await mkdir(path.join(standalone, ".next"), { recursive: true });
await cp(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), { recursive: true });
await cp(path.join(root, "public"), path.join(standalone, "public"), { recursive: true });
console.log("Prepared standalone Next.js server with public assets and client bundles.");
