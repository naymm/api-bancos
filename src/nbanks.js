import { chromium } from "playwright";
import { ACCOUNTS_URL, EMAIL, PASSWORD, SIGNIN_URL } from "./config.js";
import {
  amostraTexto,
  extrairLinhasTabela,
  movimentosDeHoje,
} from "./transactions.js";

export async function loginAndGetMovimentosHoje() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(SIGNIN_URL);
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle", { timeout: 30000 });

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

    return await movimentosDeHoje(page);
  } finally {
    await browser.close();
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
