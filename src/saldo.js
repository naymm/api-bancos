import { EMAIL, PASSWORD } from "./config.js";

const BASE_URL = "https://app.nbanks.net";

const headers = {
  Accept: "application/json",
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0",
};

const payload = { email: EMAIL, password: PASSWORD };

const endpoints = [
  "/api/v1/auth/signin",
  "/api/auth/signin",
  "/api/auth/login",
  "/auth/signin",
  "/api/login",
  "/login",
];

console.log("\n=== TESTE DE LOGIN ===\n");

for (const ep of endpoints) {
  const url = BASE_URL + ep;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();

    console.log(`URL: ${url}`);
    console.log("STATUS:", res.status);
    console.log("RESPONSE:", text.slice(0, 200));
    console.log("-".repeat(50));
  } catch (err) {
    console.log(`ERRO em ${url}: ${err.message}`);
    console.log("-".repeat(50));
  }
}
