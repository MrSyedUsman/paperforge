import path from "node:path";
import { pathToFileURL } from "node:url";
import { standaloneDirectory } from "./standalone-path.mjs";
await import(pathToFileURL(path.join(standaloneDirectory, "server.js")).href);
