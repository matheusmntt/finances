import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useRouterState,
} from '@tanstack/react-router'
import { motion } from 'motion/react'
import { useEffect } from 'react'
import { estadoQuery } from '@/api/estado'
import { sessaoQuery, useSair } from '@/api/sessao'
import { Botao, BotaoAcao } from '@/components/botao'
import { EsqueletoPagina } from '@/components/esqueleto'
import { Icone } from '@/components/icones'
import { baixarArquivo } from '@/lib/api'
import { isoHoje } from '@/lib/formato'
import { mola, padrao } from '@/lib/movimento'
import { useTema } from '@/stores/tema'
import { toastErro } from '@/stores/toast'

// Tudo o que fica atrás do login: o topo com as abas e a página de cada aba.
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context }) => {
    const { autenticado } =
      await context.queryClient.ensureQueryData(sessaoQuery)
    if (!autenticado) throw redirect({ to: '/login' })
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(estadoQuery),
  // Na primeira carga, o esqueleto da página no lugar do conteúdo (o topo e as abas já aparecem).
  pendingComponent: () => <Moldura conteudo={<EsqueletoPagina />} />,
  pendingMs: 150,
  errorComponent: ({ error }) => (
    <Moldura
      conteudo={
        <div className="cartao vazio">
          {error instanceof Error
            ? error.message
            : 'Não foi possível carregar.'}{' '}
          <Botao onClick={() => window.location.reload()}>Tentar de novo</Botao>
        </div>
      }
    />
  ),
  component: () => <Moldura conteudo={<Pagina />} />,
})

const ABAS = [
  { para: '/mes', titulo: 'Mês' },
  { para: '/salario', titulo: 'Salário' },
  { para: '/divida', titulo: 'Greici e André' },
  { para: '/projecao', titulo: 'Projeção' },
  { para: '/multas', titulo: 'Multas' },
  { para: '/backoffice', titulo: 'Backoffice' },
] as const

// A página da aba entra com um leve fade para cima ao trocar de aba (sem animar a saída: não atrasa nada).
function Pagina() {
  const caminho = useRouterState({ select: (s) => s.location.pathname })
  return (
    <motion.div
      key={caminho}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={padrao}
    >
      <Outlet />
    </motion.div>
  )
}

function Moldura({ conteudo }: { conteudo: React.ReactNode }) {
  const sair = useSair()
  const { tema, alternar, sincronizarComSistema } = useTema()
  const proximo = tema === 'escuro' ? 'claro' : 'escuro'

  useEffect(() => {
    const sistema = window.matchMedia('(prefers-color-scheme: dark)')
    sistema.addEventListener('change', sincronizarComSistema)
    return () => sistema.removeEventListener('change', sincronizarComSistema)
  }, [sincronizarComSistema])

  return (
    <main className="pagina">
      <header className="topo">
        <div>
          <p className="sobretitulo">Plano para sair das dívidas</p>
          <h1>Minhas finanças</h1>
        </div>
        <div className="acoes-topo">
          <BotaoAcao
            icone={<Icone.baixar />}
            title="Baixa uma cópia do banco de dados (SQLite)"
            textoOk="Backup baixado"
            acao={() =>
              baixarArquivo('/backup', `financas-${isoHoje()}.db`).catch(
                (e: Error) => {
                  toastErro(e.message)
                  throw e
                },
              )
            }
          >
            Baixar backup
          </BotaoAcao>
          <Botao
            soIcone
            className="botao-tema"
            aria-label={`Usar o tema ${proximo}`}
            title={`Usar o tema ${proximo}`}
            onClick={(e) => {
              const caixa = e.currentTarget.getBoundingClientRect()
              alternar({
                x: caixa.left + caixa.width / 2,
                y: caixa.top + caixa.height / 2,
              })
            }}
          >
            <motion.span
              key={proximo}
              className="icone-tema"
              initial={{ rotate: -90, scale: 0.6, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              transition={mola}
            >
              {proximo === 'escuro' ? <Icone.lua /> : <Icone.sol />}
            </motion.span>
          </Botao>
          <Botao carregando={sair.isPending} onClick={() => sair.mutate()}>
            Sair
          </Botao>
        </div>
      </header>

      <nav className="abas" aria-label="Seções">
        {ABAS.map((aba) => (
          <Link
            key={aba.para}
            to={aba.para}
            activeProps={{ 'aria-current': 'page' }}
          >
            {({ isActive }) => (
              <>
                {aba.titulo}
                {isActive ? (
                  <motion.span
                    layoutId="aba-ativa"
                    className="aba-indicador"
                    transition={mola}
                  />
                ) : null}
              </>
            )}
          </Link>
        ))}
      </nav>

      {conteudo}

      <footer className="rodape">
        <p>
          Seus dados ficam salvos no servidor. Use “Baixar backup” de vez em
          quando para guardar uma cópia.
        </p>
      </footer>
    </main>
  )
}
