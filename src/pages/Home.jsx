import { useNavigate } from 'react-router-dom'

export default function Home() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-stone-800 mb-3 tracking-tight">邦尼日历</h1>
        <p className="text-stone-400 mb-10 text-sm">记录你在意的一切</p>
        <button
          onClick={() => navigate('/create')}
          className="px-8 py-4 bg-stone-800 text-white rounded-xl font-semibold hover:bg-stone-700 active:scale-95 transition-all"
        >
          + 新建主页
        </button>
      </div>
    </div>
  )
}