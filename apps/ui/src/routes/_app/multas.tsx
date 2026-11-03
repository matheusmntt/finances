import { createFileRoute } from '@tanstack/react-router'
import { PaginaMultas } from '@/features/multas/pagina-multas'

export const Route = createFileRoute('/_app/multas')({
  component: PaginaMultas,
})
