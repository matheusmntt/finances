import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { criarContainer } from '../src/container'
import { abrirBanco } from '../src/db/connection'
import { base } from '../src/db/seed/base'
import guias from '../src/db/seed/guias-carro.json' with { type: 'json' }
import multas from '../src/db/seed/multas.json' with { type: 'json' }
import { semear } from '../src/db/seed/semear'
import type {
  GuiaExtraida,
  MultaExtraida,
} from '../src/use-cases/carro/importar-boletos'

const BOLETOS = join(import.meta.dirname, '../../../boletos')

// Banco em memória com o seed da planilha e os boletos importados, como no primeiro início do servidor.
export function montar() {
  const db = abrirBanco(':memory:')
  semear(db)
  const container = criarContainer(db, { APP_SENHA: 'senha-de-teste' })
  const importar = () =>
    container.importarBoletos.execute({
      multas: multas as MultaExtraida[],
      guias: guias as GuiaExtraida[],
      base,
      lerPdf: (arquivo) => {
        const caminho = join(BOLETOS, arquivo.replace(/^boletos\//, ''))
        return existsSync(caminho) ? readFileSync(caminho) : null
      },
    })
  importar()
  return { db, c: container, importar }
}
