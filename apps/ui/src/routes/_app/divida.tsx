import { createFileRoute } from '@tanstack/react-router'
import { PaginaDivida } from '@/features/divida/pagina-divida'

export const Route = createFileRoute('/_app/divida')({
  component: PaginaDivida,
})
