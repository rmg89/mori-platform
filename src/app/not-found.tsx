import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-parchment flex items-center justify-center p-8">
      <div className="text-center space-y-4">
        <p className="font-display text-7xl font-light text-ink-200">404</p>
        <h2 className="font-display text-2xl font-semibold text-ink">Page not found</h2>
        <p className="text-sm text-ink-400">This page doesn&apos;t exist or was moved.</p>
        <Link
          href="/dashboard"
          className="inline-block mt-2 text-sm font-medium text-white bg-ink px-5 py-2 rounded-lg hover:bg-ink-700 transition-all"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
