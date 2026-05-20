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
```

## Estrutura

```
src/
  config.js        # credenciais e URLs
  transactions.js  # extração da tabela #transaction-scroll
  login.js         # script principal
  saldo.js         # teste HTTP dos endpoints
```

Os ficheiros Python (`login.py`, `save.py`, `saldo.py`) podem ser removidos se já não forem necessários.
