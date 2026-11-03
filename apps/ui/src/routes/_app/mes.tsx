import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { PaginaMes } from '@/features/mes/pagina-mes'

export const Route = createFileRoute('/_app/mes')({
  // ?mes=2026-10 abre o mês; sem ele, o mês atual.
  validateSearch: z.object({
    mes: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional(),
  }),
  component: PaginaMes,
})
