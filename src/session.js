import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_DIR =
  process.env.SESSION_DIR ?? path.join(__dirname, "..", ".session");
export const STATE_FILE = path.join(SESSION_DIR, "storage-state.json");

export async function ensureSessionDir() {
  await fs.mkdir(SESSION_DIR, { recursive: true });
}

export async function hasStoredSession() {
  try {
    await fs.access(STATE_FILE);
    return true;
  } catch {
    return false;
  }
}

export async function saveSession(context) {
  await ensureSessionDir();
  await context.storageState({ path: STATE_FILE });
}

export async function clearSession() {
  try {
    await fs.unlink(STATE_FILE);
  } catch {
    /* ficheiro inexistente */
  }
}
