'use client'
import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-parchment flex items-center justify-center p-8">
      <div className="bg-white border border-ink-100 rounded-2xl p-8 max-w-md w-full shadow-xl text-center space-y-4">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
            <AlertTriangle size={20} className="text-red-500" />
          </div>
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink mb-1">Something went wrong</h2>
          <p className="text-sm text-ink-400">
            {error.message || 'An unexpected error occurred.'}
          </p>
          {error.digest && (
            <p className="text-[10px] text-ink-300 mt-1 font-mono">ref: {error.digest}</p>
          )}
        </div>
        <div className="flex gap-3 justify-center pt-1">
          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-sm font-medium text-white bg-ink px-5 py-2 rounded-lg hover:bg-ink-700 transition-all"
          >
            <RefreshCw size={13} /> Try again
          </button>
          <a
            href="/"
            className="flex items-center gap-1.5 text-sm font-medium text-ink-400 hover:text-ink px-5 py-2 rounded-lg hover:bg-parchment transition-all border border-ink-100"
          >
            Go to dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
