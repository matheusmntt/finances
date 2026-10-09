# Minhas finanças

App para acompanhar o plano de saída das dívidas: contas do mês, dívida com a Greici e o André (com plano de devolução editável), projeção do saldo e as multas do carro.

- **Frontend:** HTML, CSS e JS puros (`index.html`, `login.html`, `app/`).
- **Backend:** Node.js 22 sem dependências (`node:http` + `node:sqlite`), em `server/`.
- **Banco:** um arquivo SQLite (`data/financas.db`). Os PDFs dos boletos ficam dentro dele.

## Rodar no computador

Precisa do Node **22.13 ou mais novo** (`node --version`).

```bash
cp .env.example .env      # e troque a APP_SENHA
npm start                 # http://localhost:3000
```

Na primeira vez, o servidor cria o banco e semeia com os dados da planilha e dos boletos.

## Variáveis de ambiente

| Variável | Para que serve |
|---|---|
| `APP_SENHA` | Senha de acesso. **Obrigatória**, mínimo 8 caracteres. |
| `PORT` | Porta (padrão `3000`). |
| `DB_PATH` | Caminho do banco (padrão `data/financas.db`). |
| `TRUST_PROXY=1` | Use quando estiver atrás de um proxy com HTTPS. O cookie de sessão passa a ser `Secure` e o limite de tentativas de login usa o IP real. |

## Hospedar

O jeito mais simples é com Docker, guardando o banco em um volume:

```bash
docker build -t minhas-financas .
docker run -d --name financas -p 3000:3000 \
  -e APP_SENHA='sua-senha-forte' -e TRUST_PROXY=1 \
  -v financas-dados:/data minhas-financas
```

Em qualquer serviço que aceite Dockerfile, o importante é:

1. **Montar um volume persistente em `/data`.** Sem isso, o banco é apagado a cada deploy.
2. **Rodar uma réplica só.** O SQLite é um arquivo; duas cópias do app no mesmo banco não funcionam.
3. **Servir por HTTPS** e definir `TRUST_PROXY=1`.
4. **Usar uma senha forte** em `APP_SENHA`.

A rota `/saude` responde `200` sem login e serve como health check.

### Guara Cloud

O plano Starter atende: 256 MB de RAM por container (o app usa cerca de 80 MB), 1 réplica por serviço e até 3 volumes persistentes de 2 GB (o banco tem menos de 1 MB).

1. Suba o projeto para um repositório **privado** no GitHub.
2. Crie um serviço a partir do repositório usando o **Dockerfile**, na porta **3000**.
3. Adicione um **volume persistente** montado em `/data`.
4. Defina as variáveis `APP_SENHA` (senha forte) e `TRUST_PROXY=1`.
5. Faça o deploy. No primeiro início, o servidor cria o banco e semeia os dados.

Se o log mostrar "Não consigo gravar em /data", o volume foi montado sem permissão para o usuário `node` do container. Nesse caso, remova a linha `USER node` do Dockerfile e faça o deploy de novo.

> O repositório e a imagem contêm dados pessoais (boletos com placa e códigos de pagamento, valores da planilha). Mantenha o repositório **privado** e não publique a imagem em registros públicos.

## Backup

O botão **Baixar backup** no topo do app baixa uma cópia do banco (`.db`). Para restaurar, pare o servidor e coloque o arquivo no lugar de `DB_PATH`.

## Dados iniciais (seed)

O seeder junta três fontes:

- `server/seed/extraido-planilha.json`: extraído da planilha da tia. A planilha original (`despesas/`) fica só no seu computador e não vai para o repositório.
- `server/seed/extraido-multas.json` e `extraido-guias-carro.json`: extraídos dos PDFs em `boletos/`.
- `server/seed/base.js`: os dados combinados à mão (o que é devolução, CRLV e pátio, linhas removidas da planilha, descrições das infrações).

```bash
npm run seed         # semeia um banco vazio
npm run seed:reset   # APAGA tudo o que foi lançado no app e semeia de novo
```

> `seed:reset` apaga as entradas, os extras, as despesas criadas e tudo o que foi marcado como pago. Baixe um backup antes.

## Boletos novos

Coloque o PDF em `boletos/a-vencer` (ou `boletos/vencidos`) e rode:

```bash
python3 ferramentas/extrair_dados.py   # precisa de: pip install pypdf openpyxl
npm run importar                       # ou só reinicie o servidor
```

O extrator reconhece a guia de multa do Detran (GAD/M), o boleto GRU da PRF e a guia de remoção e depósito do Detran (GAD-E). Ele confere os dígitos e o valor do código de barras. O importador acrescenta as multas novas e atualiza as existentes **sem apagar** nada do que foi marcado no app. A guia do depósito preenche o custo "Pátio do depósito".

## Estrutura

```
index.html, login.html   páginas
app/                     estilos e scripts do frontend
server/server.js         servidor HTTP, login e rotas da API
server/dados.js          leitura e alterações no banco (com validação)
server/db.js             esquema do banco e migrações
server/seed.js           seeder
server/importar.js       importa boletos novos sem apagar o que foi lançado
server/seed/             dados iniciais
ferramentas/             extração dos PDFs e da planilha
boletos/                 PDFs originais (usados no primeiro seed e no importador)
```
