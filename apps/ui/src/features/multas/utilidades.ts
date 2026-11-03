// Textos e cálculos pequenos dos cartões de multas e despesas do carro.
import type { Estado, Multa } from '@/domain/tipos'
import { reais, titulo } from '@/lib/formato'

export type Nivel = 'expirada' | 'critico' | 'alerta' | 'normal'

export function prazoTexto(dias: number) {
  if (dias < -1) return `expirou há ${-dias} dias`
  if (dias === -1) return 'expirou ontem'
  if (dias === 0) return 'vence hoje'
  if (dias === 1) return 'vence amanhã'
  return `em ${dias} dias`
}

export function nivel(dias: number): Nivel {
  if (dias < 0) return 'expirada'
  if (dias <= 7) return 'critico'
  if (dias <= 15) return 'alerta'
  return 'normal'
}

const infracao = (estado: Estado, b: Multa) =>
  estado.infracoes[b.codigoInfracao] ?? null

export function descricaoMulta(estado: Estado, b: Multa) {
  return infracao(estado, b)?.descricao ?? titulo(b.descricao)
}

export function tipoMulta(estado: Estado, b: Multa) {
  const i = infracao(estado, b)
  if (i) return i.tipo
  return b.velocidade ? 'Velocidade' : 'Infração'
}

export function composicao(b: Multa) {
  if (b.cobranca === 'com-desconto') return `${reais(b.valorOriginal)} − 20%`
  if (b.juros) return `${reais(b.valorOriginal)} + ${reais(b.juros)} juros`
  return ''
}

// Boleto bancário: os 10 últimos dígitos são o valor. Guias de arrecadação não precisam disso.
export function valorNoCodigo(linha: string | null) {
  const digitos = String(linha ?? '').replace(/\D/g, '')
  return digitos.length === 47 ? Number(digitos.slice(-10)) : null
}

// Copia para a área de transferência; sem a API do navegador (http, Safari antigo), usa um textarea escondido.
export async function copiarTexto(texto: string) {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = texto
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    area.remove()
    return ok
  }
}

// Rola até o cartão e pisca o destaque.
export function rolarAte(el: HTMLElement) {
  const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'center' })
  el.classList.remove('destaque')
  void el.offsetWidth
  el.classList.add('destaque')
}
