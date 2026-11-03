import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { criarApp } from './app'
import { criarContainer } from './container'
import { abrirBanco, bancoVazio } from './db/connection'
import { base } from './db/seed/base'
import guias from './db/seed/guias-carro.json' with { type: 'json' }
import multas from './db/seed/multas.json' with { type: 'json' }
import { semear } from './db/seed/semear'
import { lerEnv } from './env'
import type {
  GuiaExtraida,
  MultaExtraida,
} from './use-cases/carro/importar-boletos'

try {
  process.loadEnvFile()
} catch {
  // Sem .env: as variáveis vêm do ambiente (Docker, hospedagem).
}

const env = lerEnv()
const db = abrirBanco(resolve(env.DB_PATH))
const container = criarContainer(db, env)

if (bancoVazio(db))
  console.log('Banco vazio: semeando com os dados iniciais...', semear(db))

// Boletos novos extraídos dos PDFs entram sem apagar nada do que foi lançado no app.
const pastaBoletos = resolve(env.BOLETOS_DIR)
const importados = container.importarBoletos.execute({
  multas: multas as MultaExtraida[],
  guias: guias as GuiaExtraida[],
  base,
  lerPdf: (arquivo) => {
    const caminho = join(pastaBoletos, arquivo.replace(/^boletos\//, ''))
    return existsSync(caminho) ? readFileSync(caminho) : null
  },
})
if (importados.multasNovas.length)
  console.log(`Multas novas importadas: ${importados.multasNovas.join(', ')}`)

const app = await criarApp({
  container,
  apiKey: env.API_KEY,
  confiarProxy: env.TRUST_PROXY,
  cookieSeguro: env.COOKIE_SEGURO || env.TRUST_PROXY,
  pastaUi: env.UI_DIR ? resolve(env.UI_DIR) : undefined,
  logger: env.NODE_ENV !== 'test',
})

await app.listen({ port: env.PORT, host: env.HOST })

for (const sinal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sinal, async () => {
    await app.close()
    db.$client.close()
    process.exit(0)
  })
}
