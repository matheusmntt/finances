// Conversão entre o valor guardado de um campo, o texto do campo na tela e o que vai para a API.
import type { Estado } from '@/domain/tipos'
import {
  brParaIso,
  formatarCampo,
  isoParaBr,
  lerReais,
  mesAtual,
  nomeMes,
} from '@/lib/formato'
import type { CampoDef, Valor } from './entidades'

const formatarTaxa = (fracao: number) =>
  (fracao * 100).toLocaleString('pt-BR', { maximumFractionDigits: 4 })

const texto = (valor: unknown) =>
  typeof valor === 'string' || typeof valor === 'number' ? String(valor) : ''

// Texto do campo na tela para o valor guardado.
export function textoDe(def: CampoDef, valor: unknown): string {
  switch (def.tipo) {
    case 'centavos':
      return typeof valor === 'number' ? formatarCampo(valor) : ''
    case 'taxa':
      return typeof valor === 'number' ? formatarTaxa(valor) : ''
    case 'dataBr':
      return typeof valor === 'string' ? brParaIso(valor) : ''
    case 'booleano':
      return valor ? 'sim' : ''
    default:
      return texto(valor)
  }
}

// Valor que vai para o servidor. undefined = o que foi digitado não dá para entender.
export function lerEntrada(def: CampoDef, bruto: string): Valor | undefined {
  const t = bruto.trim()
  switch (def.tipo) {
    case 'centavos':
      if (t === '') return def.opcional ? null : undefined
      return lerReais(t) ?? undefined
    case 'taxa': {
      const numero = Number(
        t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t,
      )
      return t === '' || !Number.isFinite(numero)
        ? undefined
        : Number((numero / 100).toFixed(8))
    }
    case 'inteiro':
      if (t === '') return def.padrao ?? null
      return Number.isInteger(Number(t)) ? Number(t) : undefined
    case 'dataBr':
      return t ? isoParaBr(t) : null
    case 'booleano':
      return t !== ''
    default:
      return t === '' ? null : t
  }
}

// Mensagem quando o que foi digitado não dá para entender.
export const mensagemInvalida = (def: CampoDef, criando = false) => {
  if (def.tipo !== 'centavos') return `Confira o campo “${def.rotulo}”.`
  return criando
    ? 'Informe um valor válido, como 150,00.'
    : 'Valor inválido. Use, por exemplo, 1.500,00.'
}

// Texto usado pelo filtro.
export function textoBusca(
  def: CampoDef,
  valor: unknown,
  estado: Estado,
): string {
  if (valor == null || valor === '') return ''
  switch (def.tipo) {
    case 'centavos':
      return typeof valor === 'number' ? formatarCampo(valor) : ''
    case 'mes':
      return typeof valor === 'string' ? `${valor} ${nomeMes(valor)}` : ''
    case 'grupo':
      return estado.grupos.find((g) => g.id === valor)?.nome ?? ''
    case 'categoria':
      return estado.categorias.find((c) => c.id === valor)?.nome ?? texto(valor)
    case 'booleano':
      return ''
    default:
      return texto(valor)
  }
}

// Valor de partida no formulário "Adicionar". Selects começam na primeira opção, como no HTML.
export function textoInicial(def: CampoDef, estado: Estado): string {
  switch (def.tipo) {
    case 'mes':
      return mesAtual()
    case 'inteiro':
      return def.padrao == null ? '' : String(def.padrao)
    case 'grupo':
      return estado.grupos[0]?.id ?? ''
    case 'categoria':
      return def.vazio || def.opcional ? '' : (estado.categorias[0]?.id ?? '')
    case 'opcao':
      return def.opcoes[0]?.[0] ?? ''
    default:
      return ''
  }
}
