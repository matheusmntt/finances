import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import { useRef } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useSalvar } from '@/api/mutacoes'
import { BotaoRemover } from '@/components/botao-remover'
import { Icone } from '@/components/icones'
import { Secao } from '@/components/secao'
import type { Calculo } from '@/domain/calculo'
import type { Emprestimo, Estado } from '@/domain/tipos'
import { nomeCategoria, OpcoesMeses, soma } from '@/features/mes/comum'
import { toastPrimeiroErro } from '@/features/mes/formulario-adicionar'
import { lerReais, mesAtual, nomeMes, plural, reais } from '@/lib/formato'

type ItemSublista = { nome: string; valor: number; remover?: Emprestimo }

// Linha com total que abre a lista dos itens que o compõem.
function Expansivel({
  id,
  titulo,
  meta,
  valor,
  itens,
  aberto,
  alternar,
  remover,
}: {
  id: string
  titulo: string
  meta: string
  valor: number
  itens: ItemSublista[]
  aberto: boolean
  alternar: () => void
  remover: (e: Emprestimo) => void
}) {
  return (
    <div className="conta conta-expansivel">
      <span className="marcador" aria-hidden="true" />
      <div className="conta-info">
        <div className="conta-nome">
          <span>{titulo}</span>
        </div>
        <p className="meta">{meta}</p>
      </div>
      <div className="conta-valor">{reais(valor)}</div>
      <button
        type="button"
        className="botao botao-icone"
        aria-expanded={aberto}
        aria-controls={id}
        aria-label="Ver itens"
        onClick={alternar}
      >
        <Icone.seta />
      </button>
      <ul className="sublista" id={id} hidden={!aberto}>
        {itens.map((l, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: itens sem id próprio (contas do mês), na ordem do estado
          <li key={i}>
            <span>{l.nome}</span>
            <span>{reais(l.valor)}</span>
            {l.remover ? (
              <BotaoRemover
                rotulo={`Remover ${l.nome}`}
                onClick={() => l.remover && remover(l.remover)}
              />
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

const esquema = z.object({
  descricao: z.string().trim().min(1, 'Informe a descrição.'),
  valor: z
    .string()
    .transform((texto) => lerReais(texto))
    .refine((v) => v != null && v > 0, 'Informe um valor válido, como 150,00.')
    .transform((v) => v as number),
  mes: z.string(),
  categoriaDivida: z.string(),
})

type Campos = z.input<typeof esquema>
type Validos = z.output<typeof esquema>

// "Registrar outro valor que eles pagaram".
function FormularioEmprestimo({
  estado,
  calculo,
}: {
  estado: Estado
  calculo: Calculo
}) {
  const salvar = useSalvar()
  const detalhes = useRef<HTMLDetailsElement>(null)
  const atual = mesAtual()
  const padrao: Campos = {
    descricao: '',
    valor: '',
    mes: calculo.indice.has(atual) ? atual : (calculo.meses[0] ?? atual),
    categoriaDivida: estado.categorias[0]?.id ?? '',
  }
  const { register, handleSubmit, reset } = useForm<Campos, unknown, Validos>({
    resolver: zodResolver(esquema),
    defaultValues: padrao,
  })

  const enviar = ({ descricao, valor, mes, categoriaDivida }: Validos) =>
    salvar.mutate(
      {
        caminho: '/emprestimos',
        corpo: { mes, descricao, valor, categoriaDivida },
        mensagem: `${descricao} registrado na dívida`,
      },
      {
        onSuccess: () => {
          reset(padrao)
          if (detalhes.current) detalhes.current.open = false
        },
      },
    )

  return (
    <details className="adicionar-detalhes" ref={detalhes}>
      <summary>
        <span className="marcador-mais" aria-hidden="true">
          <Icone.mais />
        </span>
        Registrar outro valor que eles pagaram
      </summary>
      <form
        className="form-grade"
        autoComplete="off"
        noValidate
        onSubmit={handleSubmit(enviar, (erros) =>
          toastPrimeiroErro(erros, ['descricao', 'valor']),
        )}
      >
        <label className="campo-rotulo largo">
          Descrição
          <input
            className="campo"
            maxLength={120}
            placeholder="Ex.: Conserto do carro"
            {...register('descricao')}
          />
        </label>
        <label className="campo-rotulo">
          Valor
          <input
            className="campo campo-valor"
            inputMode="decimal"
            placeholder="0,00"
            {...register('valor')}
          />
        </label>
        <label className="campo-rotulo">
          Mês
          <select className="campo" {...register('mes')}>
            <OpcoesMeses meses={calculo.meses} />
          </select>
        </label>
        <label className="campo-rotulo largo">
          Parte da dívida
          <select className="campo" {...register('categoriaDivida')}>
            {estado.categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <div className="form-acoes">
          <button type="submit" className="botao botao-primario">
            Registrar
          </button>
        </div>
      </form>
    </details>
  )
}

// "O que eles pagaram por você": contas atrasadas, empréstimos agrupados por origem e o carro.
export function PagasPorEles({
  estado,
  calculo,
  abertos,
  alternar,
}: {
  estado: Estado
  calculo: Calculo
  abertos: Set<string>
  alternar: (id: string) => void
}) {
  const salvar = useSalvar()

  const remover = (e: Emprestimo) => {
    if (
      !window.confirm(`Tirar “${e.descricao}” (${reais(e.valor)}) da dívida?`)
    )
      return
    salvar.mutate({
      caminho: `/emprestimos/${e.id}`,
      metodo: 'DELETE',
      mensagem: `${e.descricao} removido da dívida`,
      desfazer: () =>
        salvar.mutate({
          caminho: '/emprestimos',
          corpo: {
            mes: e.mes,
            descricao: e.descricao,
            valor: e.valor,
            categoriaDivida: e.categoriaDivida,
            origem: e.origem,
          },
        }),
    })
  }

  const expansivel = (
    id: string,
    titulo: string,
    meta: string,
    valor: number,
    itens: ItemSublista[],
  ) => (
    <Expansivel
      key={id}
      id={id}
      titulo={titulo}
      meta={meta}
      valor={valor}
      itens={itens}
      aberto={abertos.has(id)}
      alternar={() => alternar(id)}
      remover={remover}
    />
  )

  const contasAtrasadas = calculo.porMes
    .filter((p) => p.pagoPorCredores)
    .map((p) => {
      const contas = estado.despesas.filter(
        (x) => x.valores[p.mes]?.pagoPorCredores,
      )
      return expansivel(
        `exp-contas-${p.mes}`,
        `Contas atrasadas quitadas em ${nomeMes(p.mes)}`,
        `${plural(contas.length, 'conta', 'contas')}: condomínio, aluguel, luz e outras`,
        p.pagoPorCredores,
        contas.map((x) => ({
          nome: x.nome,
          valor: x.valores[p.mes]?.valor ?? 0,
        })),
      )
    })

  // Empréstimos agrupados por origem e mês ("Cartão da Greici em agosto de 2026").
  const grupos = new Map<
    string,
    { origem: string; mes: string | null; itens: Emprestimo[] }
  >()
  for (const e of estado.emprestimos) {
    const chave = `${e.origem}|${e.mes ?? ''}`
    const grupo = grupos.get(chave) ?? {
      origem: e.origem,
      mes: e.mes,
      itens: [],
    }
    grupo.itens.push(e)
    grupos.set(chave, grupo)
  }
  const emprestimos = [...grupos.values()].map((g) => {
    const quando = g.mes ? ` em ${nomeMes(g.mes)}` : ''
    const [unico] = g.itens
    if (g.itens.length === 1 && unico) {
      return (
        <div className="conta conta-com-acao" key={`emp-${unico.id}`}>
          <span className="marcador" aria-hidden="true" />
          <div className="conta-info">
            <div className="conta-nome">
              <span>{unico.descricao}</span>
            </div>
            <p className="meta">
              {`${g.origem}${quando} · ${nomeCategoria(estado, unico.categoriaDivida)}`}
            </p>
          </div>
          <div className="conta-valor">{reais(unico.valor)}</div>
          <BotaoRemover
            rotulo={`Remover ${unico.descricao}`}
            onClick={() => remover(unico)}
          />
        </div>
      )
    }
    return expansivel(
      `exp-${g.origem}-${g.mes}`.replace(/[^\w-]/g, '-'),
      `${g.origem}${quando}`,
      plural(g.itens.length, 'item', 'itens'),
      soma(g.itens.map((e) => e.valor)),
      g.itens.map((e) => ({ nome: e.descricao, valor: e.valor, remover: e })),
    )
  })

  const { carro } = calculo
  return (
    <Secao
      titulo="O que eles pagaram por você"
      descricao="Contas de agosto, despesas da Greici, compras no cartão e o que for marcado como pago na aba Multas."
      total={reais(calculo.divida.pagoPorEles)}
      legendaTotal="até agora"
    >
      <div className="cartao contas">
        {contasAtrasadas}
        {emprestimos}
        <div className="conta">
          <span className="marcador" aria-hidden="true" />
          <div className="conta-info">
            <div className="conta-nome">
              <span>Carro: multas, CRLV e pátio</span>
              <Link className="tag tag-link" to="/multas">
                Ver
              </Link>
            </div>
            <p className="meta">
              {carro.qtdPagos} de {carro.qtdTotal} itens pagos por eles
              {carro.emAberto ? ` · ainda faltam ${reais(carro.emAberto)}` : ''}
            </p>
          </div>
          <div className="conta-valor">{reais(carro.pago)}</div>
        </div>
        <FormularioEmprestimo estado={estado} calculo={calculo} />
      </div>
    </Secao>
  )
}
