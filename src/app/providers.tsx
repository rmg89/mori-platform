'use client'
import { StoreProvider } from '@/lib/store'
import ReportProblem from '@/components/ReportProblem'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      {children}
      <ReportProblem />
    </StoreProvider>
  )
}
