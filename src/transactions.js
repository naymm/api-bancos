export const COLUNAS = [
  "Categoria",
  "Data",
  "Data Valor",
  "Descrição",
  "Nota/Tag",
  "Montante (AOA)",
  "Saldo (AOA)",
];

const RE_DATA = /\d{2}\/\d{2}\/\d{4}/;

export function parseData(texto) {
  const match = (texto ?? "").trim().match(RE_DATA);
  if (!match) return null;
  const [dia, mes, ano] = match[0].split("/").map(Number);
  return new Date(ano, mes - 1, dia);
}

export function isHoje(data) {
  if (!data) return false;
  const hoje = new Date();
  return (
    data.getDate() === hoje.getDate() &&
    data.getMonth() === hoje.getMonth() &&
    data.getFullYear() === hoje.getFullYear()
  );
}

export function normalizarLinha(cells) {
  for (const start of [0, 1]) {
    if (cells.length < start + 7) continue;
    const dataCells = cells.slice(start, start + 7);
    if (dataCells[0].toLowerCase() === "categoria") continue;
    if (parseData(dataCells[2])) {
      return Object.fromEntries(COLUNAS.map((k, i) => [k, dataCells[i]]));
    }
  }
  return null;
}

export async function scrollTabela(page) {
  await page.evaluate(() => {
    const el = document.getElementById("transaction-scroll");
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    el.scrollTop = 0;
  });
  await page.waitForTimeout(500);
}

export async function extrairLinhasTabela(page) {
  await scrollTabela(page);
  return page.evaluate(() => {
    const container = document.getElementById("transaction-scroll");
    if (!container) return [];

    const linhas = [];
    const seen = new Set();
    const RE_DATA = /^\d{2}\/\d{2}\/\d{4}$/;
    const RE_MONTANTE = /^[+\-][\d.,]+$/;
    const RE_SALDO = /^\d{1,3}(\.\d{3})*(,\d{1,2})?$/;
    const HEADERS = new Set([
      "Categoria",
      "Data",
      "Data Valor",
      "Descrição",
      "Nota/Tag",
      "Montante (AOA)",
      "Saldo (AOA)",
      "Cash Inflow",
      "Cash Outflow",
    ]);

    const pushRow = (cells) => {
      const row = cells.map((c) => c.replace(/\s+/g, " ").trim());
      const key = row.join("|");
      if (row.length >= 7 && !seen.has(key)) {
        seen.add(key);
        linhas.push(row);
      }
    };

    const rowSelectors = [
      "table tbody tr",
      "mat-row",
      ".mat-row",
      ".ag-row",
      ".ag-center-cols-container .ag-row",
      "tr",
      '[role="row"]',
    ];
    for (const sel of rowSelectors) {
      container.querySelectorAll(sel).forEach((row) => {
        if (row.querySelector("th")) return;
        const cells = [...row.querySelectorAll(
          "td, mat-cell, .ag-cell, [role='cell']"
        )].map((el) => el.innerText);
        if (cells.length >= 7) pushRow(cells);
      });
    }

    container.querySelectorAll("div, li, article").forEach((node) => {
      const parts = node.innerText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length < 6 || parts.length > 14) return;

      const dates = parts.filter((p) => RE_DATA.test(p));
      const montante = parts.find((p) => RE_MONTANTE.test(p));
      const saldo = parts.find((p) => RE_SALDO.test(p) && !RE_MONTANTE.test(p));
      if (dates.length < 2 || !montante || !saldo) return;

      const cat = parts.find(
        (p) =>
          !RE_DATA.test(p) &&
          !RE_MONTANTE.test(p) &&
          p !== saldo &&
          !p.startsWith("+ Associar") &&
          !HEADERS.has(p)
      );
      if (!cat) return;

      const data = dates[0];
      const dataValor = dates[1];
      const desc =
        parts.find(
          (p) =>
            p !== cat &&
            p !== data &&
            p !== dataValor &&
            p !== montante &&
            p !== saldo &&
            !p.startsWith("+ Associar") &&
            !HEADERS.has(p)
        ) || "";

      pushRow([cat, data, dataValor, desc, "", montante, saldo]);
    });

    if (linhas.length) return linhas;

    const lines = container.innerText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (
        HEADERS.has(line) ||
        line.startsWith("Montante") ||
        line.startsWith("+ Associar")
      ) {
        i++;
        continue;
      }
      if (RE_DATA.test(line) || RE_MONTANTE.test(line)) {
        i++;
        continue;
      }

      const cat = line;
      i++;
      if (i + 5 >= lines.length) break;
      if (!RE_DATA.test(lines[i])) continue;
      const data = lines[i++];
      if (!RE_DATA.test(lines[i])) continue;
      const dataValor = lines[i++];

      let desc = lines[i++];
      if (desc.startsWith("+ Associar")) desc = lines[i++] || "";

      if (i >= lines.length || !RE_MONTANTE.test(lines[i])) continue;
      const montante = lines[i++];
      if (i >= lines.length || !RE_SALDO.test(lines[i])) continue;
      const saldo = lines[i++];

      pushRow([cat, data, dataValor, desc, "", montante, saldo]);
    }

    return linhas;
  });
}

export async function movimentosDeHoje(page) {
  const linhas = await extrairLinhasTabela(page);
  const movimentos = [];

  for (const cells of linhas) {
    const movimento = normalizarLinha(cells);
    if (!movimento) continue;
    if (isHoje(parseData(movimento["Data Valor"]))) {
      movimentos.push(movimento);
    }
  }

  return movimentos;
}

export async function amostraTexto(page) {
  return page.evaluate(() => {
    const el = document.getElementById("transaction-scroll");
    if (!el) return "(sem #transaction-scroll)";
    const t = el.innerText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    return t.slice(0, 20).join(" | ");
  });
}
