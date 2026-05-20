import { chromium } from "playwright";
import { ACCOUNTS_URL, EMAIL, PASSWORD, SIGNIN_URL } from "./config.js";
import {
  amostraTexto,
  extrairLinhasTabela,
  movimentosDeHoje,
} from "./transactions.js";
import {
  clearSession,
  hasStoredSession,
  saveSession,
  STATE_FILE,
} from "./session.js";

const RE_SIGNIN = /\/auth\/signin/i;

let browserSingleton = null;
let contextSingleton = null;

async function getBrowser() {
  if (!browserSingleton || !browserSingleton.isConnected()) {
    browserSingleton = await chromium.launch({ headless: true });
  }
  return browserSingleton;
}

async function newContext(browser, { storageState } = {}) {
  const opts = storageState ? { storageState } : {};
  return browser.newContext(opts);
}

async function isOnSignInPage(page) {
  if (RE_SIGNIN.test(page.url())) return true;
  const email = page.locator('input[type="email"]');
  return (await email.count()) > 0 && (await email.isVisible());
}

async function performLogin(page) {
  await page.goto(SIGNIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle", { timeout: 30000 });
}

async function waitForTransactions(page) {
  await page.goto(ACCOUNTS_URL, {
    waitUntil: "networkidle",
    timeout: 30000,
  });
  await page.waitForSelector("#transaction-scroll", { timeout: 30000 });
  await page.waitForFunction(
    () => {
      const el = document.getElementById("transaction-scroll");
      return el && /\d{2}\/\d{2}\/\d{4}/.test(el.innerText);
    },
    { timeout: 30000 }
  );
}

async function sessionStillValid(page) {
  await page.goto(ACCOUNTS_URL, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  if (await isOnSignInPage(page)) return false;
  try {
    await page.waitForSelector("#transaction-scroll", { timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}

async function getOrCreateContext(browser) {
  if (contextSingleton) return contextSingleton;

  if (await hasStoredSession()) {
    contextSingleton = await newContext(browser, { storageState: STATE_FILE });
    const page = await contextSingleton.newPage();
    try {
      if (await sessionStillValid(page)) {
        await page.close();
        return contextSingleton;
      }
    } finally {
      await page.close().catch(() => {});
    }
    await contextSingleton.close().catch(() => {});
    contextSingleton = null;
    await clearSession();
  }

  contextSingleton = await newContext(browser);
  return contextSingleton;
}

/**
 * @returns {{ movimentos: object[], auth: "session" | "login" }}
 */
async function fetchMovimentosWithContext(context) {
  const page = await context.newPage();
  let auth = "session";

  try {
    if (!(await sessionStillValid(page))) {
      auth = "login";
      await performLogin(page);
      await waitForTransactions(page);
      await saveSession(context);
    } else {
      await waitForTransactions(page);
    }

    const movimentos = await movimentosDeHoje(page);
    return { movimentos, auth };
  } finally {
    await page.close().catch(() => {});
  }
}

export async function loginAndGetMovimentosHoje() {
  const browser = await getBrowser();
  const context = await getOrCreateContext(browser);
  const { movimentos, auth } = await fetchMovimentosWithContext(context);

  if (auth === "login") {
    console.log("Login efetuado; sessão guardada em", STATE_FILE);
  } else {
    console.log("Sessão reutilizada (sem novo login)");
  }

  return movimentos;
}

/** Expõe se a última chamada usaria sessão (útil para testes). */
export async function getMovimentosHojeWithMeta() {
  const browser = await getBrowser();
  const context = await getOrCreateContext(browser);
  return fetchMovimentosWithContext(context);
}

export async function closeBrowserSession() {
  if (contextSingleton) {
    await contextSingleton.close().catch(() => {});
    contextSingleton = null;
  }
  if (browserSingleton) {
    await browserSingleton.close().catch(() => {});
    browserSingleton = null;
  }
}

export async function debugMovimentos(page) {
  const hoje = new Date().toISOString().slice(0, 10);
  const linhas = await extrairLinhasTabela(page);
  console.log(`Nenhum movimento para ${hoje}.`);
  console.log(`Linhas brutas extraídas: ${linhas.length}`);
  if (linhas.length) {
    console.log("Exemplo 1ª linha:", JSON.stringify(linhas[0]));
  } else {
    console.log("Texto visível (amostra):", await amostraTexto(page));
  }
}
