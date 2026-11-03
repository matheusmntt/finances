import type { Calculo } from '@/domain/calculo'
import type { LinhaProjecao, Resumo } from '@/domain/projecao'
import type { Estado } from '@/domain/tipos'

// Tudo o que as partes da aba precisam: a projeção mostrada (com a simulação, se houver) e a do plano.
export type Projecao = {
  estado: Estado
  calculo: Calculo
  mesAtual: string
  simulando: boolean
  linhas: LinhaProjecao[]
  r: Resumo
  // O plano sem a simulação, para comparar ("No plano: ...").
  base: LinhaProjecao[]
  rb: Resumo
}
