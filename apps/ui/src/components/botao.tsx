import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Icone } from './icones'

type Variante = 'padrao' | 'primario' | 'fantasma' | 'perigo'

type BotaoProps = Omit<ComponentProps<'button'>, 'type'> & {
  variante?: Variante
  icone?: ReactNode
  // Só o ícone (quadrado): o texto vai em aria-label.
  soIcone?: boolean
  // Ação em andamento: o ícone vira um spinner e o botão fica desabilitado, sem mudar de tamanho.
  carregando?: boolean
  type?: 'button' | 'submit'
}

export function Botao({
  variante = 'padrao',
  icone,
  soIcone,
  carregando,
  className,
  disabled,
  children,
  type = 'button',
  ...props
}: BotaoProps) {
  const classes = [
    'botao',
    variante !== 'padrao' && `botao-${variante}`,
    soIcone && 'botao-icone',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button
      {...props}
      type={type}
      className={classes}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      data-estado={carregando ? 'carregando' : undefined}
    >
      {carregando ? <Icone.carregando /> : icone}
      {children}
    </button>
  )
}

type Estado = 'parado' | 'carregando' | 'ok' | 'erro'

type BotaoAcaoProps = Omit<BotaoProps, 'onClick' | 'carregando'> & {
  // A ação: enquanto a promise não termina, spinner; deu certo, um ✓ por um instante; falhou, o botão
  // balança (a mensagem de erro é do chamador, normalmente um toast).
  acao: () => Promise<unknown>
  textoOk?: ReactNode
}

// Botão com o feedback da ação dentro dele, sem spinner na página.
export function BotaoAcao({
  acao,
  textoOk,
  children,
  icone,
  ...props
}: BotaoAcaoProps) {
  const [estado, setEstado] = useState<Estado>('parado')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const voltar = (ms: number) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setEstado('parado'), ms)
  }

  return (
    <Botao
      {...props}
      icone={estado === 'ok' ? <Icone.ok /> : icone}
      carregando={estado === 'carregando'}
      data-feedback={estado === 'ok' || estado === 'erro' ? estado : undefined}
      onClick={async () => {
        if (estado === 'carregando') return
        setEstado('carregando')
        try {
          await acao()
          setEstado('ok')
          voltar(1400)
        } catch {
          setEstado('erro')
          voltar(500)
        }
      }}
    >
      {estado === 'ok' && textoOk ? textoOk : children}
    </Botao>
  )
}
