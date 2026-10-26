# Minhas finanças

App para acompanhar o plano de saída das dívidas: contas do mês, salário (folhas de pagamento em PDF), dívida com a Greici e o André (com plano de devolução editável), projeção do saldo e as multas do carro.

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

## Salário (folhas de pagamento)

Na aba **Salário** (ou em "Enviar folha de pagamento", na seção Entradas da aba Mês) você envia o PDF do recibo. O servidor lê o texto do PDF, sem dependências, e guarda tipo e competência, empresa, cargo, cada vencimento e desconto, bases de INSS e IRRF, FGTS, conta do depósito e o próprio PDF, que dá para abrir depois.

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

O `app/manifest.json` define nome, ícones (`app/icone-*.png`; o `maskable` é recortado no formato do Android) e atalhos para Mês, Salário e Projeção. O service worker (`app/sw.js`, servido em `/sw.js`) só mostra a página `app/offline.html` quando o servidor não responde. Ele **não guarda dados em cache**: contas, folhas e boletos vêm sempre do servidor. Ao mudar `offline.html`, troque o nome do cache (`financas-v1`) em `sw.js` para os aparelhos baixarem a versão nova.

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

> `seed:reset` apaga as entradas, os extras, as folhas de pagamento, as despesas criadas e tudo o que foi marcado como pago. Baixe um backup antes.

## Boletos novos

Solte o PDF em `boletos/` (em qualquer lugar da pasta) e rode:

```bash
python3 ferramentas/extrair_dados.py   # precisa de: pip install pypdf openpyxl
npm run importar                       # ou só reinicie o servidor
```

O extrator reconhece pelo conteúdo a guia de multa do Detran (GAD/M), o boleto GRU da PRF e a guia de remoção e depósito do Detran (GAD-E), confere os dígitos e o valor do código de barras e **organiza o arquivo** na pasta do tipo, com um nome reconhecível:

```
boletos/
  multas/detran/<série>.pdf     guias de multa do Detran (ex.: E032837207.pdf)
  multas/prf/<série>.pdf        boletos da PRF (ex.: N006153327.pdf)
  carro/patio-<guia>.pdf        guias de remoção e diárias do depósito
```

Não há mais pastas "a vencer" e "vencidos": o tipo de cobrança da guia (com 20% de desconto ou com juros) é lido do PDF, e a aba Multas separa as guias pela validade, calculada com a data de hoje: válidas, com a validade vencida (é preciso emitir outra) e pagas. O importador acrescenta as multas novas e atualiza as existentes **sem apagar** nada do que foi marcado no app. A primeira guia do depósito preenche o custo "Pátio do depósito"; cada guia nova (mais diárias) entra como um custo próprio, "Pátio do depósito (guia N)". Multas, infrações e custos alterados na aba Backoffice não são atualizados.

## Estrutura

```
index.html, login.html   páginas
app/                     estilos e scripts do frontend
server/server.js         servidor HTTP, login e rotas da API
server/dados.js          leitura e alterações no banco (com validação)
server/backoffice.js     edição direta das tabelas (aba Backoffice)
server/holerite.js       leitura do PDF da folha de pagamento
server/db.js             esquema do banco e migrações
server/seed.js           seeder
server/importar.js       importa boletos novos sem apagar o que foi lançado
server/seed/             dados iniciais
ferramentas/             extração dos PDFs e da planilha
boletos/                 PDFs dos boletos, organizados por tipo (usados no seed e no importador)
```
