import fs from "node:fs";
import { fileURLToPath } from "node:url";
const env = fileURLToPath(new URL("../.env", import.meta.url));
if (fs.existsSync(env)) process.loadEnvFile(env);
