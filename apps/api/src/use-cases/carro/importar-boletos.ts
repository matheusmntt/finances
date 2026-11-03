import type {
  CarroRepository,
  MultaImportada,
} from '../../repositories/carro-repository'

// Formato dos arquivos gerados por ferramentas/extrair_dados.py a partir dos PDFs em boletos/.
export type MultaExtraida = Omit<
  MultaImportada,
  | 'arquivo'
  | 'pdf'
  | 'velocidadeMedida'
  | 'velocidadeConsiderada'
  | 'velocidadeLimite'
> & {
  arquivo: string
  velocidade: { medida: number; considerada: number; limite: number } | null
}

export type GuiaExtraida = {
  tipo: string
  guia: string
  arquivo: string
  emissao: string // DD/MM/AAAA
  validade: string
  itens: { descricao: string; quantidade: number; valor: number }[]
  valor: number
  linhaDigitavel: string
}

export type DadosBase = {
  infracoes: readonly { codigo: string; descricao: string; tipo: string }[]
  custosCarro: readonly {
    chave: string
    descricao: string
    detalhe: string
    valor: number
    ordem: number
  }[]
  // Que custo do carro cada tipo de guia preenche (deposito -> patio).
  guiasCarro: Readonly<Record<string, string>>
}

export type ImportarBoletosInput = {
  multas: readonly MultaExtraida[]
  guias: readonly GuiaExtraida[]
  base: DadosBase
  // Lê o PDF pelo caminho relativo à raiz do projeto ("boletos/multas/detran/X.pdf"); null se não existir.
  lerPdf: (arquivo: string) => Buffer | null
}

const reais = (centavos: number) =>
  (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

// "Remoção R$ 395,27 + 34 diárias R$ 1.378,02 (R$ 40,53 por dia)"
function detalheGuia(guia: GuiaExtraida) {
  return guia.itens
    .map((item) => {
      const nome = (item.descricao.split(' ')[0] ?? '').toLowerCase()
      if (item.quantidade === 1)
        return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} ${reais(item.valor)}`
      const unitario = Math.round(item.valor / item.quantidade)
      return `${item.quantidade} ${nome.replace(/a$/, 'as')} ${reais(item.valor)} (${reais(unitario)} por dia)`
    })
    .join(' + ')
}

const ordemData = (ddmmaaaa: string) => ddmmaaaa.split('/').reverse().join('')
const nomeArquivo = (caminho: string) => caminho.split('/').pop() ?? caminho

// Leva os boletos extraídos dos PDFs para o banco sem apagar nada do que foi lançado no app: multas novas
// entram, as existentes têm os dados atualizados e continuam com a marcação de pago. O que foi alterado no
// Backoffice não é sobrescrito. Roda a cada início do servidor.
export class ImportarBoletosUseCase {
  constructor(private readonly carro: CarroRepository) {}

  execute({ multas, guias, base, lerPdf }: ImportarBoletosInput) {
    const resultado = {
      multasNovas: [] as string[],
      multasAtualizadas: 0,
      guias: [] as string[],
    }

    for (const i of base.infracoes)
      this.carro.gravarInfracao(i.codigo, i.descricao, i.tipo)

    for (const { velocidade, arquivo, ...m } of multas) {
      if (this.carro.existeMulta(m.serie)) resultado.multasAtualizadas++
      else resultado.multasNovas.push(m.serie)
      this.carro.gravarMulta({
        ...m,
        arquivo: nomeArquivo(arquivo),
        pdf: lerPdf(arquivo),
        velocidadeMedida: velocidade?.medida ?? null,
        velocidadeConsiderada: velocidade?.considerada ?? null,
        velocidadeLimite: velocidade?.limite ?? null,
      })
    }

    // Custos de base (CRLV e pátio) só entram se ainda não existirem.
    for (const custo of base.custosCarro) this.carro.garantirCusto(custo)

    // A primeira guia de cada tipo preenche o custo de base (o "Pátio do depósito"); cada guia seguinte
    // (novas diárias, por exemplo) vira um custo próprio, ligado pelo número da guia.
    const emOrdem = [...guias].sort(
      (a, b) =>
        ordemData(a.emissao).localeCompare(ordemData(b.emissao)) ||
        a.guia.localeCompare(b.guia),
    )
    for (const g of emOrdem) {
      const chaveBase = base.guiasCarro[g.tipo]
      if (!chaveBase) continue
      let chave = this.carro.chaveDoCustoDaGuia(g.guia)
      if (!chave) {
        if (this.carro.custoSemGuia(chaveBase)) chave = chaveBase
        else {
          chave = `${chaveBase}-${g.guia}`
          const descricao =
            base.custosCarro.find((c) => c.chave === chaveBase)?.descricao ??
            'Guia do carro'
          this.carro.criarCustoVazio(chave, `${descricao} (guia ${g.guia})`)
        }
      }
      const aplicada = this.carro.aplicarGuia(chave, {
        valor: g.valor,
        detalhe: detalheGuia(g),
        guia: g.guia,
        validade: g.validade,
        linhaDigitavel: g.linhaDigitavel,
        arquivo: nomeArquivo(g.arquivo),
        pdf: lerPdf(g.arquivo),
      })
      if (aplicada) resultado.guias.push(`${chave} (guia ${g.guia})`)
    }
    return resultado
  }
}
