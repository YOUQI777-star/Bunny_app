import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const CATEGORIES = [
  { value: 'pet',     emoji: '🐾', label: '宠物',  desc: '毛茸茸的家人' },
  { value: 'person',  emoji: '🧑', label: '人物',  desc: '值得记住的人' },
  { value: 'thing',   emoji: '🪴', label: '事物',  desc: '有故事的存在' },
  { value: 'bottle',  emoji: '🍶', label: '漂流瓶', desc: '私密的记录' },
]

export default function Home() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  function handleCategoryClick(category) {
    if (!user) {
      navigate('/auth')
      return
    }
    navigate(`/create?category=${category}`)
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-lg mx-auto px-4 pt-12 pb-16">

        {/* 欢迎语 */}
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-stone-800 tracking-tight">
            {user ? `你好 👋` : '开始记录'}
          </h2>
          <p className="text-stone-400 mt-1 text-sm">
            {user ? '选择一个分类，开始新的记录' : '登录后记录你在意的一切'}
          </p>
        </div>

        {/* 四个入口 */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => handleCategoryClick(cat.value)}
              className="bg-white border border-stone-100 rounded-2xl p-5 text-left hover:border-stone-300 hover:shadow-sm active:scale-95 transition-all"
            >
              <div className="text-3xl mb-3">{cat.emoji}</div>
              <div className="font-semibold text-stone-800 text-sm">{cat.label}</div>
              <div className="text-xs text-stone-400 mt-0.5">{cat.desc}</div>
            </button>
          ))}
        </div>

        {/* 未登录提示 */}
        {!user && (
          <div className="text-center">
            <button
              onClick={() => navigate('/auth')}
              className="text-sm text-stone-400 underline underline-offset-2"
            >
              登录 / 注册账号
            </button>
          </div>
        )}

        {/* 已登录：快捷入口去个人主页 */}
        {user && (
          <button
            onClick={() => navigate('/profile')}
            className="w-full py-3 border border-stone-200 rounded-xl text-sm text-stone-500 hover:bg-stone-100 transition-colors"
          >
            查看我的所有记录 →
          </button>
        )}

      </div>
    </div>
  )
}