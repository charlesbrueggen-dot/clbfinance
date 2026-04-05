import { useNavigate } from 'react-router-dom'

export default function Cancel() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
      <div className="text-6xl mb-4">😕</div>
      <h2 className="text-xl font-black text-primary mb-2">Payment cancelled</h2>
      <p className="text-muted text-sm mb-8">No worries — you haven't been charged. You can upgrade anytime.</p>
      <button onClick={() => navigate('/')} className="btn-primary px-8">
        Back to Stride
      </button>
    </div>
  )
}
