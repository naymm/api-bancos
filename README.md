# nbanks-api (Node.js)

Automação do [nbanks.net](https://app.nbanks.net) com Playwright: login e movimentos do dia (filtro por **Data Valor**).

## Requisitos

- Node.js 18+
- npm

## Instalação

```bash
npm install
npx playwright install chromium
```

Opcional: copiar credenciais

```bash
cp .env.example .env
# editar .env ou exportar variáveis:
# export EMAIL=...
# export PASSWORD=...
# export ACCOUNTS_URL=...
```

## Comandos

```bash
npm run login   # movimentos de hoje (JSON no terminal)
npm run saldo   # teste de endpoints de login via API
npm start       # servidor HTTP para n8n / integrações
```

## Integração com n8n

Fluxo:

```
Trigger (Cron / Manual / Webhook)
        ↓
   HTTP Request
        ↓
   API (este projeto)
        ↓
   JSON → n8n
```

### 1. Subir a API

```bash
cp .env.example .env   # EMAIL, PASSWORD, ACCOUNTS_URL, API_KEY
export $(grep -v '^#' .env | xargs)   # ou: set -a && source .env && set +a
npm start
```

A API fica em `http://127.0.0.1:3000` (ou `PORT` no `.env`).

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/health` | Health check (rápido) |
| `GET` | `/api/movimentos/hoje` | Login Playwright + movimentos do dia |

Resposta de sucesso (`/api/movimentos/hoje`):

```json
{
  "ok": true,
  "count": 2,
  "fetchedAt": "2026-05-20T10:00:00.000Z",
  "data": [
    {
      "Categoria": "...",
      "Data": "20/05/2026",
      "Data Valor": "20/05/2026",
      "Descrição": "...",
      "Montante (AOA)": "+1.000,00",
      "Saldo (AOA)": "10.000,00"
    }
  ]
}
```

Autenticação (recomendado): header `X-API-Key: <API_KEY>` ou query `?apiKey=<API_KEY>`.

**Sessão:** na 1.ª chamada faz login e guarda cookies em `.session/`. Nas seguintes reutiliza a sessão (sem preencher email/senha) enquanto o nbanks não expirar a sessão. A resposta inclui `"auth": "session"` ou `"auth": "login"`.

**Nota:** a 1.ª chamada demora mais (30–90 s); com sessão válida costuma ser mais rápida. No n8n, **Timeout** ≥ **120000** ms. Só um pedido de scraping corre de cada vez (429 se outro estiver ativo).

### 2. n8n — nó HTTP Request

| Campo | Valor |
|-------|--------|
| Method | `GET` |
| URL | `http://SEU_HOST:3000/api/movimentos/hoje` |
| Authentication | Header Auth **ou** Query: `apiKey` = valor de `API_KEY` |
| Header (alternativa) | `X-API-Key` = `API_KEY` |
| Response Format | JSON |
| Timeout | `120000` (ms) |

**Cron:** Schedule Trigger → HTTP Request (como acima) → opcional: Filter / Set / Google Sheets / Slack.

**Manual:** Manual Trigger → HTTP Request.

**Webhook:** Webhook Trigger → HTTP Request (a API continua a ser chamada *pelo* n8n, não precisa de webhook na API).

### 3. n8n na cloud + API no seu Mac

O n8n cloud não alcança `localhost`. Use um túnel, por exemplo:

```bash
ngrok http 3000
```

No n8n, URL: `https://xxxx.ngrok-free.app/api/movimentos/hoje`.

Ou hospede a API num VPS/Docker na mesma rede que o n8n self-hosted.

### 4. Usar os dados no n8n

Depois do HTTP Request, os movimentos ficam em `$json.data` (array). Exemplos:

- **Item Lists → Split Out Items:** campo `data`
- **Set:** `{{ $json.data[0]['Montante (AOA)'] }}`
- **IF:** `{{ $json.count > 0 }}`

## Estrutura

```
src/
  config.js        # credenciais e URLs
  transactions.js  # extração da tabela #transaction-scroll
  login.js         # script principal
  saldo.js         # teste HTTP dos endpoints
  server.js        # API HTTP (n8n)
  nbanks.js        # login Playwright reutilizável
```

Os ficheiros Python (`login.py`, `save.py`, `saldo.py`) podem ser removidos se já não forem necessários.
