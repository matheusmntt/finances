import { env } from '@/env'

// Erro com a mensagem que a API mandou ({ erro: "..." }), pronta para mostrar ao usuário.
export class ApiError extends Error {
  readonly status: number

  constructor(mensagem: string, status: number) {
    super(mensagem)
    this.status = status
  }
}

type Corpo = unknown | Blob

// Chamada à API: manda a API key em toda requisição e o cookie de sessão. 401 sem sessão leva ao login.
export async function api<T = void>(
  caminho: string,
  opcoes: { metodo?: string; corpo?: Corpo; nomeArquivo?: string } = {},
) {
  const headers: Record<string, string> = { 'x-api-key': env.VITE_API_KEY }
  let body: BodyInit | undefined
  if (opcoes.corpo instanceof Blob) {
    headers['Content-Type'] = opcoes.corpo.type || 'application/pdf'
    headers['x-nome-arquivo'] = encodeURIComponent(opcoes.nomeArquivo ?? '')
    body = opcoes.corpo
  } else if (opcoes.corpo !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opcoes.corpo)
  }

  let resposta: Response
  try {
    resposta = await fetch(`${env.VITE_API_URL}${caminho}`, {
      method: opcoes.metodo ?? 'GET',
      headers,
      body,
      credentials: 'same-origin',
    })
  } catch {
    throw new ApiError('Sem conexão com o servidor. Tente de novo.', 0)
  }

  if (!resposta.ok) {
    const dados = (await resposta.json().catch(() => ({}))) as { erro?: string }
    if (resposta.status === 401 && !caminho.startsWith('/auth/'))
      window.location.assign('/login')
    throw new ApiError(
      dados.erro ?? 'Não foi possível salvar.',
      resposta.status,
    )
  }
  if (resposta.status === 204 || resposta.headers.get('content-length') === '0')
    return undefined as T
  const tipo = resposta.headers.get('content-type') ?? ''
  return (
    tipo.includes('application/json')
      ? await resposta.json()
      : await resposta.blob()
  ) as T
}

// Abre um PDF da API numa aba nova. Links diretos não mandam o cabeçalho x-api-key, então baixa como blob.
export async function abrirArquivo(caminho: string) {
  const aba = window.open('', '_blank')
  let blob: Blob
  try {
    blob = await api<Blob>(caminho)
  } catch (erro) {
    aba?.close()
    throw erro
  }
  const url = URL.createObjectURL(blob)
  if (aba) aba.location.href = url
  else window.location.assign(url)
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

// Baixa um arquivo da API com o nome sugerido (backup do banco).
export async function baixarArquivo(caminho: string, nome: string) {
  const blob = await api<Blob>(caminho)
  const url = URL.createObjectURL(blob)
  const link = Object.assign(document.createElement('a'), {
    href: url,
    download: nome,
  })
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
