import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { AnimatePresence, motion, useAnimate } from 'motion/react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { sessaoQuery, useEntrar } from '@/api/sessao'
import { Botao } from '@/components/botao'
import { mola, padrao, rapida } from '@/lib/movimento'
import { useTitulo } from '@/lib/titulo'

const esquema = z.object({ senha: z.string().min(1, 'Informe a senha.') })

export const Route = createFileRoute('/login')({
  beforeLoad: async ({ context }) => {
    const { autenticado } =
      await context.queryClient.ensureQueryData(sessaoQuery)
    if (autenticado) throw redirect({ to: '/mes' })
  },
  component: Login,
})

function Login() {
  useTitulo('Entrar')
  const navegar = useNavigate()
  const entrar = useEntrar()
  const form = useForm<z.infer<typeof esquema>>({
    resolver: zodResolver(esquema),
    defaultValues: { senha: '' },
  })
  const [escopo, animar] = useAnimate<HTMLFormElement>()
  const erro = form.formState.errors.senha?.message ?? entrar.error?.message

  return (
    <div className="pagina-login">
      <main className="login">
        <motion.form
          className="cartao login-cartao"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          ref={escopo}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={mola}
          autoComplete="on"
          onSubmit={form.handleSubmit(({ senha }) =>
            entrar.mutate(senha, {
              onSuccess: () => navegar({ to: '/mes' }),
              onError: () => {
                form.setFocus('senha')
                // Senha errada: o cartão balança de leve.
                animar(
                  escopo.current,
                  { x: [0, -8, 7, -4, 2, 0] },
                  { duration: 0.32 },
                )
              },
            }),
          )}
        >
          <p className="sobretitulo">Plano para sair das dívidas</p>
          <h1>Minhas finanças</h1>
          <label className="campo-rotulo" htmlFor="senha">
            Senha
            <input
              className="campo"
              id="senha"
              type="password"
              autoComplete="current-password"
              // biome-ignore lint/a11y/noAutofocus: a tela só tem esse campo
              autoFocus
              {...form.register('senha')}
            />
          </label>
          <AnimatePresence initial={false}>
            {erro ? (
              <motion.p
                className="login-erro"
                role="alert"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto', transition: padrao }}
                exit={{ opacity: 0, height: 0, transition: rapida }}
              >
                {erro}
              </motion.p>
            ) : null}
          </AnimatePresence>
          <Botao
            type="submit"
            variante="primario"
            carregando={entrar.isPending || entrar.isSuccess}
          >
            {entrar.isPending || entrar.isSuccess ? 'Entrando…' : 'Entrar'}
          </Botao>
        </motion.form>
      </main>
    </div>
  )
}
