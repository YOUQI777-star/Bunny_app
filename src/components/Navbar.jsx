import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { signOut } from '../lib/auth'

export default function Navbar() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSignOut() {
    await signOut()
    setMenuOpen(false)
    navigate('/')
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-stone-50/90 backdrop-blur-sm border-b border-stone-100">
      <div className="max-w-lg mx-auto px-4 h-12 flex items-center justify-between">

        {/* Logo */}
        <button onClick={() => navigate('/')} className="text-sm font-semibold text-stone-700 tracking-tight">
          邦尼日历
        </button>

        {/* 右侧 */}
        {user ? (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-8 h-8 rounded-full bg-stone-800 text-white text-xs font-semibold flex items-center justify-center"
            >
              {user.email[0].toUpperCase()}
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-10 bg-white border border-stone-100 rounded-xl shadow-lg py-1 w-36 z-50">
                <button
                  onClick={() => { navigate('/profile'); setMenuOpen(false) }}
                  className="w-full text-left px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50"
                >
                  我的院子
                </button>
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-stone-50"
                >
                  退出登录
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => navigate('/auth')}
            className="text-xs px-3 py-1.5 bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition-colors"
          >
            登录 / 注册
          </button>
        )}
      </div>
    </nav>
  )
}