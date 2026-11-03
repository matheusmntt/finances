import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { MotionConfig } from 'motion/react'
import { DialogoConfirmar } from '@/components/dialogo-confirmar'
import { Toast } from '@/components/toast'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    component: () => (
      // Quem pediu menos movimento no sistema não vê as animações do motion (as do CSS zeram no global.css).
      <MotionConfig reducedMotion="user">
        <Outlet />
        <Toast />
        <DialogoConfirmar />
      </MotionConfig>
    ),
  },
)
