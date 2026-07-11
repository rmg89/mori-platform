'use client'
import { ArchiveRestore } from 'lucide-react'
import { useStore } from '@/lib/store'

interface UnarchiveButtonProps {
  engagementId: string
  className?: string
  onClick?: (e: React.MouseEvent) => void
}

export default function UnarchiveButton({ engagementId, className, onClick }: UnarchiveButtonProps) {
  const { unarchiveEngagement } = useStore()
  return (
    <button
      onClick={ev => { onClick?.(ev); unarchiveEngagement(engagementId) }}
      className={className ?? 'flex items-center gap-1.5 text-xs font-medium text-ink-500 border border-ink-200 px-4 py-2 rounded-lg hover:bg-ink hover:text-white hover:border-ink transition-all flex-shrink-0'}
    >
      <ArchiveRestore size={13} /> Unarchive
    </button>
  )
}
