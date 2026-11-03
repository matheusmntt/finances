import { zodResolver } from '@hookform/resolvers/zod'
import { useRef } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useSalvar } from '@/api/mutacoes'
import { Icone } from '@/components/icones'
import type { Estado } from '@/domain/tipos'
import { lerReais, plural } from '@/lib/formato'
import { OpcoesMeses } from './comum'
import { toastPrimeiroErro } from './formulario-adicionar'

const esquema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da despesa.'),
  valor: z
    .string()
    .transform((texto) => lerReais(texto))
    .refine((v) => v != null && v > 0, 'Informe o valor por mês, como 199,90.')
    .transform((v) => v as number),
  parcelas: z
    .string()
    .trim()
    .transform((texto) => (texto ? Number(texto) : null))
    .refine(
      (n) => n == null || (Number.isInteger(n) && n >= 1 && n <= 120),
      'As parcelas devem ser um número entre 1 e 120.',
    ),
  mesInicio: z.string(),
  grupoId: z.string(),
  // "" = não; "direto" = pago direto a eles; "devolucao:<categoria>" = parcela da devolução.
  paraCredores: z.string(),
})

type Campos = z.input<typeof esquema>
type Validos = z.output<typeof esquema>

// "Adicionar despesa fixa ou parcelada", no fim da aba Mês.
export function NovaDespesa({
  estado,
  meses,
  mes,
}: {
  estado: Estado
  meses: string[]
  mes: string
}) {
  const salvar = useSalvar()
  const detalhes = useRef<HTMLDetailsElement>(null)
  const padrao: Campos = {
    nome: '',
    valor: '',
    parcelas: '',
    mesInicio: mes,
    grupoId:
      estado.grupos.find((g) => g.id === 'despesas-fixas')?.id ??
      estado.grupos[0]?.id ??
      '',
    paraCredores: '',
  }
  const { register, handleSubmit, reset } = useForm<Campos, unknown, Validos>({
    resolver: zodResolver(esquema),
    defaultValues: padrao,
  })

  const enviar = (campos: Validos) => {
    const { nome, valor, parcelas, mesInicio, grupoId, paraCredores } = campos
    salvar.mutate(
      {
        caminho: '/despesas',
        corpo: {
          nome,
          valor,
          parcelas,
          mesInicio,
          grupoId,
          categoriaDivida: paraCredores.startsWith('devolucao:')
            ? paraCredores.slice('devolucao:'.length)
            : null,
          pagoAosCredores: paraCredores === 'direto',
        },
        mensagem: parcelas
          ? `${nome} adicionada em ${plural(parcelas, 'parcela', 'parcelas')}`
          : `${nome} adicionada todo mês`,
      },
      {
        onSuccess: () => {
          reset(padrao)
          if (detalhes.current) detalhes.current.open = false
        },
      },
    )
  }

  return (
    <details className="cartao nova-despesa" id="nova-despesa" ref={detalhes}>
      <summary>
        <span className="marcador-mais" aria-hidden="true">
          <Icone.mais />
        </span>
        Adicionar despesa fixa ou parcelada
      </summary>
      <form
        className="form-grade"
        autoComplete="off"
        noValidate
        onSubmit={handleSubmit(enviar, (erros) =>
          toastPrimeiroErro(erros, ['nome', 'valor', 'parcelas']),
        )}
      >
        <label className="campo-rotulo largo">
          Nome
          <input
            className="campo"
            maxLength={120}
            placeholder="Ex.: Celular novo em 10x"
            {...register('nome')}
          />
        </label>
        <label className="campo-rotulo">
          Valor por mês
          <input
            className="campo campo-valor"
            inputMode="decimal"
            placeholder="0,00"
            {...register('valor')}
          />
        </label>
        <label className="campo-rotulo">
          Primeiro mês
          <select className="campo" {...register('mesInicio')}>
            <OpcoesMeses meses={meses} />
          </select>
        </label>
        <label className="campo-rotulo">
          Parcelas
          <input
            className="campo"
            type="number"
            min={1}
            max={120}
            placeholder="Vazio = todo mês"
            {...register('parcelas')}
          />
        </label>
        <label className="campo-rotulo">
          Grupo
          <select className="campo" {...register('grupoId')}>
            {estado.grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="campo-rotulo largo">
          Você paga para a Greici e o André?
          <select className="campo" {...register('paraCredores')}>
            <option value="">Não</option>
            <option value="direto">
              Sim, pago direto a eles (não é devolução)
            </option>
            {estado.categorias.map((c) => (
              <option key={c.id} value={`devolucao:${c.id}`}>
                Sim, é devolução: {c.nome}
              </option>
            ))}
          </select>
        </label>
        <div className="form-acoes">
          <button type="submit" className="botao botao-primario">
            Adicionar
          </button>
        </div>
      </form>
    </details>
  )
}
