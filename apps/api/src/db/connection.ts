import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import { type BetterSQLite3Database, drizzle } from 'drizzle-orm/better-sqlite3'
import { MIGRACOES } from './migrations'
import * as schema from './schema'

export type Banco = BetterSQLite3Database<typeof schema> & {
  $client: Database.Database
}

// Abre o banco (":memory:" nos testes), liga WAL e chaves estrangeiras e aplica as migrações que faltarem.
export function abrirBanco(caminho: string): Banco {
  if (caminho !== ':memory:') mkdirSync(dirname(caminho), { recursive: true })
  const sqlite = new Database(caminho)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000')
  migrar(sqlite)
  return drizzle({ client: sqlite, schema })
}

function migrar(sqlite: Database.Database) {
  const versao = sqlite.pragma('user_version', { simple: true }) as number
  if (versao > MIGRACOES.length) {
    throw new Error(
      `O banco está na versão ${versao}, mais nova que este código (${MIGRACOES.length}). Atualize o app.`,
    )
  }
  for (let v = versao; v < MIGRACOES.length; v++) {
    sqlite.transaction(() => {
      sqlite.exec(MIGRACOES[v] as string)
      sqlite.pragma(`user_version = ${v + 1}`)
    })()
  }
}

export function bancoVazio(db: Banco): boolean {
  return !db.$client.prepare('SELECT 1 FROM despesas LIMIT 1').get()
}
