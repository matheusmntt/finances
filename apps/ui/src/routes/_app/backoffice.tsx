import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { PaginaBackoffice } from '@/features/backoffice/pagina-backoffice'

export const Route = createFileRoute('/_app/backoffice')({
  // ?tabela=multas abre essa tabela; ?despesa=11 escolhe a despesa em "Valores por mês".
  validateSearch: z.object({
    tabela: z.string().optional(),
    despesa: z.coerce.number().int().optional(),
  }),
  component: PaginaBackoffice,
})
