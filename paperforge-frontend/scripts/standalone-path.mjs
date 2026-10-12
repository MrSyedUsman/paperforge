import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(projectRoot, ".next", "standalone");
const nested = path.join(output, path.basename(projectRoot));
export const standaloneDirectory = existsSync(path.join(nested, "server.js")) ? nested : output;
