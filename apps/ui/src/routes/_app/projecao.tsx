import { createFileRoute } from '@tanstack/react-router'
import { PaginaProjecao } from '@/features/projecao/pagina-projecao'

export const Route = createFileRoute('/_app/projecao')({
  component: PaginaProjecao,
})
