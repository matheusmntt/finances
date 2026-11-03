import { zodResolver } from '@hookform/resolvers/zod'
import { type FieldErrors, useForm } from 'react-hook-form'
import { z } from 'zod'
import { useSalvar } from '@/api/mutacoes'
import { Icone } from '@/components/icones'
import { lerReais } from '@/lib/formato'
import { toast } from '@/stores/toast'

type Tipo = 'entrada' | 'extra'

const VALOR_INVALIDO = 'Informe um valor válido, como 150,00.'

// Entrada aceita valor zero (nota ainda sem valor); extra precisa ser maior que zero.
const esquema = (tipo: Tipo) =>
  z.object({
    descricao: z.string().trim().min(1, 'Informe a descrição.'),
    valor: z
      .string()
      .transform((texto) => lerReais(texto))
      .refine((v) => v != null && (tipo === 'entrada' || v > 0), VALOR_INVALIDO)
      .transform((v) => v as number),
  })

type Campos = z.input<ReturnType<typeof esquema>>
type Validos = z.output<ReturnType<typeof esquema>>

// Mostra o primeiro erro (na ordem dos campos) num toast, como a v1.
export function toastPrimeiroErro(erros: FieldErrors, ordem: string[]) {
  for (const campo of ordem) {
    const mensagem = erros[campo]?.message
    if (typeof mensagem === 'string') {
      toast(mensagem)
      return
    }
  }
}

// Linha "+ Nova entrada / R$ / Adicionar" no fim das listas de entradas e extras.
export function FormularioAdicionar({
  tipo,
  mes,
  placeholder,
}: {
  tipo: Tipo
  mes: string
  placeholder: string
}) {
  const salvar = useSalvar()
  const { register, handleSubmit, reset, setFocus } = useForm<
    Campos,
    unknown,
    Validos
  >({
    resolver: zodResolver(esquema(tipo)),
    defaultValues: { descricao: '', valor: '' },
  })

  const enviar = ({ descricao, valor }: Validos) =>
    salvar.mutate(
      {
        caminho: tipo === 'entrada' ? '/entradas' : '/extras',
        corpo: { mes, descricao, valor },
        mensagem: `${descricao} adicionad${tipo === 'entrada' ? 'a' : 'o'}`,
      },
      {
        onSuccess: () => {
          reset()
          setFocus('descricao')
        },
      },
    )

  return (
    <form
      className="linha-adicionar"
      autoComplete="off"
      noValidate
      onSubmit={handleSubmit(enviar, (erros) =>
        toastPrimeiroErro(erros, ['descricao', 'valor']),
      )}
    >
      <span className="marcador-mais" aria-hidden="true">
        <Icone.mais />
      </span>
      <input
        className="campo"
        placeholder={placeholder}
        maxLength={120}
        aria-label="Descrição"
        {...register('descricao')}
      />
      <input
        className="campo campo-valor"
        placeholder="0,00"
        inputMode="decimal"
        aria-label="Valor"
        {...register('valor')}
      />
      <button type="submit" className="botao">
        Adicionar
      </button>
    </form>
  )
}
