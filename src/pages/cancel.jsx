import { useRouter } from 'next/router'

export default function Cancel() {
  const router = useRouter()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
      <div className="text-6xl mb-4">😕</div>
      <h1 className="text-2xl font-black text-primary mb-2">Payment Cancelled</h1>
      <p className="text-muted text-sm mb-8 max-w-sm">
        No worries — you haven't been charged. You can upgrade to Pro anytime you're ready.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => router.push('/')}
          className="btn-secondary px-6"
        >
          Back to App
        </button>
        <button
          onClick={() => router.back()}
          className="btn-primary px-6"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
