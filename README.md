# Minhas finanças

App para acompanhar o plano de saída das dívidas: contas do mês, salário (folhas de pagamento em PDF), dívida com a Greici e o André (com plano de devolução editável), projeção do saldo e as multas do carro.

Monorepo com pnpm workspaces:

- **`apps/api`**: Fastify 5 + Zod, SQLite com Drizzle (better-sqlite3), organizado em use-cases (`src/use-cases`), repositórios (`src/repositories`) e rotas HTTP (`src/http`).
- **`apps/ui`**: React 19 + TypeScript com Vite, TanStack Router e Query, Zustand, React Hook Form e Zod. Os cálculos (mês, dívida, projeção) ficam em `src/domain`, como funções puras.
- **`legacy/`**: a v1 (HTML/JS puros + `node:sqlite`), só para consulta. O banco é o mesmo: a v2 abre um banco da v1 e aplica as migrações que faltam.

## Rodar no computador

Precisa do Node **26** (`nvm use`, pelo `.nvmrc`) e do pnpm **12**.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # API_KEY e APP_SENHA
cp apps/ui/.env.example apps/ui/.env     # VITE_API_KEY igual à API_KEY
pnpm dev                                 # UI em http://localhost:5173, API em :3333
```

Na primeira vez, a API cria o banco (`data/financas.db`) e semeia com os dados da planilha e dos boletos. Em desenvolvimento, o Vite repassa `/api` para a API, então o cookie de sessão funciona sem CORS.

```bash
pnpm typecheck   # tsc nos dois projetos
pnpm lint        # Biome
pnpm test        # Vitest (use-cases da API)
pnpm build       # apps/api/dist e apps/ui/dist
```

## Autenticação

Duas camadas:

1. **API key.** Toda rota em `/api` (menos `/api/health`) exige o cabeçalho `x-api-key` igual a `API_KEY`. A UI manda `VITE_API_KEY`. Como variáveis `VITE_` vão para o JavaScript do navegador, a chave **não é segredo**: ela só diz que a requisição vem do app.
2. **Senha.** Os dados exigem uma sessão, criada no login com `APP_SENHA` (cookie `HttpOnly`, assinado, 30 dias). Depois de 10 senhas erradas em 15 minutos, o IP espera. As sessões da v1 continuam valendo.

## Variáveis de ambiente

API (`apps/api/.env`):

| Variável | Para que serve |
|---|---|
| `API_KEY` | Chave esperada no cabeçalho `x-api-key`. **Obrigatória**, mínimo 16 caracteres (`openssl rand -hex 24`). |
| `APP_SENHA` | Senha de acesso. **Obrigatória**, mínimo 8 caracteres. |
| `PORT` / `HOST` | Porta (padrão `3333`) e interface (padrão `0.0.0.0`). |
| `DB_PATH` | Caminho do banco (padrão `../../data/financas.db`). |
| `BOLETOS_DIR` | Pasta dos PDFs dos boletos (padrão `../../boletos`). |
| `UI_DIR` | Build da UI. Preenchida, a API também serve o app (é o que o Docker faz). |
| `TRUST_PROXY=1` | Atrás de um proxy com HTTPS: o cookie passa a ser `Secure` e o limite de tentativas usa o IP real. |

UI (`apps/ui/.env`, lidas no build):

| Variável | Para que serve |
|---|---|
| `VITE_API_KEY` | A mesma chave da API. |
| `VITE_API_URL` | Endereço da API (padrão `/api`, mesma origem). |

## Hospedar

Com Docker, guardando o banco em um volume. A imagem tem a API servindo também a UI, numa porta só:

```bash
docker build -t minhas-financas --build-arg VITE_API_KEY='a-chave' .
docker run -d --name financas -p 3000:3000 \
  -e API_KEY='a-chave' -e APP_SENHA='sua-senha-forte' -e TRUST_PROXY=1 \
  -v financas-dados:/data minhas-financas
```

Em qualquer serviço que aceite Dockerfile, o importante é:

1. **Montar um volume persistente em `/data`.** Sem isso, o banco é apagado a cada deploy.
2. **Rodar uma réplica só.** O SQLite é um arquivo; duas cópias do app no mesmo banco não funcionam.
3. **Servir por HTTPS** e definir `TRUST_PROXY=1`.
4. **Usar uma senha forte** em `APP_SENHA` e passar a mesma chave em `VITE_API_KEY` (build) e `API_KEY` (execução).

A rota `/api/health` responde `200` sem chave nem login e serve como health check (na v1 era `/saude`).

Os arquivos de `assets/` têm hash no nome e ficam em cache para sempre; `index.html`, `sw.js` e o manifest são revalidados a cada acesso, então um deploy novo chega sem limpar o cache.

> O repositório e a imagem contêm dados pessoais (boletos com placa e códigos de pagamento, valores da planilha). Mantenha o repositório **privado** e não publique a imagem em registros públicos.

## Salário (folhas de pagamento)

Na aba **Salário** (ou em "Enviar folha de pagamento", na seção Entradas da aba Mês) você envia o PDF do recibo. A API lê o texto do PDF, sem dependências, e guarda tipo e competência, empresa, cargo, cada vencimento e desconto, bases de INSS e IRRF, FGTS, conta do depósito e o próprio PDF, que dá para abrir depois.

O **líquido entra nas entradas do mês em que foi pago** (a data do recibo): a folha de 08/2026 paga em 04/09/2026 conta em setembro. Para contar em outro mês, mude "Entra no mês" no Backoffice. Se você já tinha lançado esse salário como entrada à mão, a aba Mês avisa para remover a entrada antiga.

**Salário previsto.** Do mês atual em diante, cada mês sem folha mensal recebe o líquido da última folha de mês cheio (a de um mês incompleto, como a do primeiro mês na empresa, não conta). Ele aparece como "Salário previsto" na aba Mês e some quando a folha daquele mês é enviada. Para usar outro valor (um aumento já combinado, por exemplo), preencha "Salário previsto" nas configurações do Backoffice; vazio volta a usar a folha. 13º, férias, notas PJ e outras rendas são lançados como entradas.

O leitor espera o modelo do recibo atual ("Folha Mensal de MM/AAAA", tabela com Hrs/Qtde, Vencimentos e Descontos, totais e "Líquido") e confere se os itens fecham com os totais e o líquido. Se não fecharem, ou se o PDF for outro modelo, ele recusa o arquivo e nada é salvo. A mesma folha (tipo e competência) não pode ser enviada duas vezes.

## Projeção

- **Cards:** quando você fica livre das dívidas, a sobra por mês depois disso, o guardado no fim do plano, o patrimônio de hoje e o salário previsto.
- **Gráficos:** o guardado no CDB, o mesmo dinheiro parado na conta corrente (soma das sobras, sem render), o que falta devolver e a linha do cenário abaixo; embaixo, a sobra de cada mês. Nos próximos 12 meses ou até o fim do plano. O tracejado e as barras mais claras são previsão.
- **CDB:** a sobra de cada mês a partir de `cdbInicio` vira um lote que rende `cdbTaxaMensal` e paga IR pela tabela regressiva (22,5% até 6 meses, 20% até 12, 17,5% até 24 e 15% depois). O guardado mostrado já é líquido de IR.
- **Dívida:** parte do total que a Greici e o André pagam (inclusive o que falta do carro) e desconta as parcelas de devolução; nos meses que já passaram, só as marcadas como pagas.
- **Cenário investindo X% do bruto:** depois que a dívida zera, só X% do salário bruto da última folha mensal (ou a sobra, se for menor) vai para o CDB; o resto da sobra fica na conta, sem render. A linha mostra a parte investida; o tooltip e o card do guardado mostram também o que ficou na conta. X fica no próprio gráfico (padrão 20%).
- **Metas:** a reserva de emergência (N meses de despesas depois das parcelas; N fica nas configurações) e metas suas em reais, com o mês em que cada valor é alcançado nos dois cenários. No cenário dos X%, a reserva conta só o que está investido; as outras metas contam o investido mais a conta.
- **Simulador:** renda a mais ou a menos a partir de um mês, gasto extra (ou economia), antecipar a devolução e outra taxa do CDB. Muda só o que a aba mostra; nada é salvo.
- **Mês a mês:** um resumo por ano que abre os meses.

## Backoffice

A aba **Backoffice** edita direto no banco tudo o que as outras abas não editam: configurações do plano, do CDB, do salário previsto e da reserva de emergência, despesas (nome, grupo, devolução, ordem e o valor de cada mês), entradas, extras, o que a Greici e o André pagaram, multas, outras despesas do carro, folhas de pagamento, metas, infrações, grupos e categorias da dívida. Cada campo é salvo ao sair dele, com a mesma validação do servidor, e não há como desfazer: baixe um backup antes de mudanças grandes.

Multas, infrações e os dados de guia dos custos do carro alterados ali ficam marcados e o importador de boletos não os sobrescreve mais. Multas não podem ser removidas (o importador as traria de volta); para tirar uma da conta, zere o valor.

## App instalado (PWA)

O app pode ser instalado como aplicativo (precisa de HTTPS, que a hospedagem já tem):

- **Chrome ou Edge no computador:** ícone de instalar na barra de endereço.
- **Android (Chrome):** menu ⋮ → **Instalar app**.
- **iPhone (Safari):** Compartilhar → **Adicionar à Tela de Início**.

O `apps/ui/public/manifest.json` define nome, ícones (`icone-*.png`; o `maskable` é recortado no formato do Android) e atalhos para Mês, Salário e Projeção. O service worker (`apps/ui/public/sw.js`) só é registrado no build de produção e só mostra a página `offline.html` quando o servidor não responde. Ele **não guarda dados em cache**: contas, folhas e boletos vêm sempre do servidor. Ao mudar `offline.html`, troque o nome do cache (`financas-v1`) em `sw.js` para os aparelhos baixarem a versão nova.

## Backup

O botão **Baixar backup** no topo do app baixa uma cópia do banco (`.db`). Para restaurar, pare a API e coloque o arquivo no lugar de `DB_PATH`.

## Dados iniciais (seed)

Quando o banco está vazio, a API semeia juntando três fontes, em `apps/api/src/db/seed/`:

- `planilha.json`: extraído da planilha da tia. A planilha original (`despesas/`) fica só no seu computador e não vai para o repositório.
- `multas.json` e `guias-carro.json`: extraídos dos PDFs em `boletos/`.
- `base.ts`: os dados combinados à mão (o que é devolução, CRLV e pátio, linhas removidas da planilha, descrições das infrações).

## Boletos novos

Solte o PDF em `boletos/` (em qualquer lugar da pasta), rode o extrator e reinicie a API (o importador roda a cada início):

```bash
python3 ferramentas/extrair_dados.py   # precisa de: pip install pypdf openpyxl
```

O extrator grava `multas.json`, `guias-carro.json` e `planilha.json` em `apps/api/src/db/seed/`.

O extrator reconhece pelo conteúdo a guia de multa do Detran (GAD/M), o boleto GRU da PRF e a guia de remoção e depósito do Detran (GAD-E), confere os dígitos e o valor do código de barras e **organiza o arquivo** na pasta do tipo, com um nome reconhecível:

```
boletos/
  multas/detran/<série>.pdf     guias de multa do Detran (ex.: E032837207.pdf)
  multas/prf/<série>.pdf        boletos da PRF (ex.: N006153327.pdf)
  carro/patio-<guia>.pdf        guias de remoção e diárias do depósito
```

O tipo de cobrança da guia (com 20% de desconto ou com juros) é lido do PDF, e a aba Multas separa as guias pela validade, calculada com a data de hoje: válidas, com a validade vencida (é preciso emitir outra) e pagas. O importador acrescenta as multas novas e atualiza as existentes **sem apagar** nada do que foi marcado no app. A primeira guia do depósito preenche o custo "Pátio do depósito"; cada guia nova (mais diárias) entra como um custo próprio, "Pátio do depósito (guia N)". Multas, infrações e custos alterados na aba Backoffice não são atualizados.

## Estrutura

```
apps/api/src/
  server.ts              inicia: banco, seed, importador de boletos, HTTP
  app.ts                 Fastify, autenticação, rotas e a UI estática
  env.ts                 variáveis de ambiente (validadas com Zod)
  use-cases/             uma classe por operação (regras de negócio)
  repositories/          acesso ao banco com Drizzle
  http/                  rotas, plugin de autenticação e erros
  db/                    esquema, migrações e seed
  lib/                   leitura do PDF da folha de pagamento, sessões
apps/ui/src/
  routes/                rotas do TanStack Router (uma por aba)
  features/              as páginas de cada aba
  domain/                cálculos do mês, da dívida e da projeção
  api/                   chamadas à API (TanStack Query)
  stores/                estado compartilhado (Zustand)
  components/            componentes comuns (gráfico, seções, avisos)
legacy/                  a v1, só para consulta
ferramentas/             extração dos PDFs e da planilha
boletos/                 PDFs dos boletos, organizados por tipo
```
