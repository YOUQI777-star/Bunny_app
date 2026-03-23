import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signIn, signUp } from '../lib/auth'

export default function Auth() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) { setError('请填写邮箱和密码'); return }
    if (password.length < 6) { setError('密码至少6位'); return }
    setLoading(true)
    setError('')
    setSuccess('')

    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) { setError('邮箱或密码错误'); setLoading(false); return }
      navigate('/profile')
    } else {
      const { error } = await signUp(email, password)
      if (error) { setError(error.message); setLoading(false); return }
      setSuccess('注册成功！请检查邮箱确认链接，然后登录。')
      setMode('login')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-stone-800 tracking-tight">邦尼日历</h1>
          <p className="text-stone-400 mt-2 text-sm">记录你在意的一切</p>
        </div>

        {/* 切换 */}
        <div className="flex bg-stone-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => { setMode('login'); setError(''); setSuccess('') }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all
              ${mode === 'login' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-400'}`}
          >登录</button>
          <button
            onClick={() => { setMode('signup'); setError(''); setSuccess('') }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all
              ${mode === 'signup' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-400'}`}
          >注册</button>
        </div>

        {/* 表单 */}
        <div className="space-y-3 mb-6">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="邮箱地址"
            className="w-full px-4 py-3 rounded-xl bg-white border border-stone-200 text-stone-800 placeholder-stone-300 focus:outline-none focus:border-stone-400 transition-colors text-base"
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="密码（至少6位）"
            className="w-full px-4 py-3 rounded-xl bg-white border border-stone-200 text-stone-800 placeholder-stone-300 focus:outline-none focus:border-stone-400 transition-colors text-base"
          />
        </div>

        {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}
        {success && <p className="text-green-500 text-sm mb-4 text-center">{success}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-4 bg-stone-800 text-white rounded-xl font-semibold text-base hover:bg-stone-700 active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? '处理中...' : mode === 'login' ? '登录 →' : '注册 →'}
        </button>

      </div>
    </div>
  )
}