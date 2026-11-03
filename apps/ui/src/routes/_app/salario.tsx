import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { PaginaSalario } from '@/features/salario/pagina-salario'

export const Route = createFileRoute('/_app/salario')({
  // ?folha=3 abre os detalhes dessa folha e rola até ela.
  validateSearch: z.object({ folha: z.coerce.number().int().optional() }),
  component: PaginaSalario,
})
