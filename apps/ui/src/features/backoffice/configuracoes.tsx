import { Secao } from '@/components/secao'
import type { Estado } from '@/domain/tipos'
import { CampoInline } from './campo-inline'
import type { CampoDef, EntidadeConfig, Valor } from './entidades'

// Configurações: um cartão só, com um campo rotulado para cada valor.
export function Configuracoes({
  entidade: e,
  estado,
  onSalvar,
}: {
  entidade: EntidadeConfig
  estado: Estado
  onSalvar: (def: CampoDef, valor: Valor) => Promise<boolean>
}) {
  return (
    <Secao titulo={e.titulo} descricao={e.descricao}>
      <div className="cartao">
        <div className="form-grade bo-grade bo-grade-config">
          {e.campos.map((def) => (
            <CampoInline
              key={def.campo}
              def={def}
              valor={estado.config[def.campo]}
              estado={estado}
              foco={`bo-config-${def.campo}`}
              rotulado
              onSalvar={(valor) => onSalvar(def, valor)}
            />
          ))}
        </div>
      </div>
    </Secao>
  )
}
