import http from "node:http";
import {
  closeBrowserSession,
  getMovimentosHojeWithMeta,
} from "./nbanks.js";

const PORT = Number(process.env.PORT ?? 3000);
const API_KEY = process.env.API_KEY ?? "";

let emExecucao = false;

function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(body));
}

function autorizado(req, url) {
  if (!API_KEY) return true;
  const header = req.headers["x-api-key"];
  const query = url.searchParams.get("apiKey");
  return header === API_KEY || query === API_KEY;
}

async function movimentosHoje(res) {
  if (emExecucao) {
    json(res, 429, {
      ok: false,
      error: "Já existe um pedido em curso. Aguarde e tente novamente.",
    });
    return;
  }

  emExecucao = true;
  try {
    const { movimentos, auth } = await getMovimentosHojeWithMeta();
    json(res, 200, {
      ok: true,
      auth,
      count: movimentos.length,
      fetchedAt: new Date().toISOString(),
      data: movimentos,
    });
  } catch (err) {
    json(res, 500, {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    emExecucao = false;
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
    });
    res.end();
    return;
  }

  if (!autorizado(req, url)) {
    json(res, 401, { ok: false, error: "API key inválida ou em falta" });
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    json(res, 200, { ok: true, service: "nbanks-api" });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/movimentos/hoje") {
    await movimentosHoje(res);
    return;
  }

  json(res, 404, {
    ok: false,
    error: "Rota não encontrada",
    rotas: ["GET /health", "GET /api/movimentos/hoje"],
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`API nbanks: http://127.0.0.1:${PORT}`);
  console.log(`  GET /health`);
  console.log(`  GET /api/movimentos/hoje`);
  console.log("  Sessão: reutiliza login guardado (.session/) enquanto válido");
  if (!API_KEY) {
    console.warn("AVISO: API_KEY não definida — API aberta na rede local.");
  }
});

async function shutdown() {
  await closeBrowserSession();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
