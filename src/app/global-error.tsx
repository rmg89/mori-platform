'use client'

// Catches failures in the root layout itself, which app/error.tsx cannot reach.
// Renders its own <html>/<body> because the layout is what broke.

import { useEffect } from 'react'
import { captureError } from '@/lib/error-reporting'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[RootError]', error)
    captureError({
      kind: 'render',
      message: error.message || 'Unknown root layout error',
      stack: error.stack,
      context: { digest: error.digest, boundary: 'global-error' },
    })
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#FAF8F3', color: '#1A1A1A' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Something went wrong</h2>
            <p style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>
              {error.message || 'An unexpected error occurred.'}
            </p>
            {error.digest && (
              <p style={{ fontSize: 11, color: '#999', fontFamily: 'monospace', marginBottom: 20 }}>
                ref: {error.digest}
              </p>
            )}
            <p style={{ fontSize: 12, color: '#888', marginBottom: 20 }}>
              This has been reported automatically.
            </p>
            <button
              onClick={reset}
              style={{
                fontSize: 14, fontWeight: 500, color: '#fff', background: '#1A1A1A',
                border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
