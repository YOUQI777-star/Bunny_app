import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const CATEGORY_LABELS = {
  pet: '🐾 宠物', person: '🧑 人物', thing: '🪴 事物', bottle: '🌌 漂流瓶'
}

const ALL_TAG = '全部'

export default function Profile() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTag, setActiveTag] = useState(ALL_TAG)
  const [activeCategory, setActiveCategory] = useState(ALL_TAG)
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'timeline'
  const [selectedYear, setSelectedYear] = useState(ALL_TAG)

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      const { data } = await supabase
        .from('subjects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setSubjects(data || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  // 收集所有标签
  const allTags = [ALL_TAG, ...new Set(subjects.flatMap(s => s.tags || []))]
  const allCategories = [ALL_TAG, ...new Set(subjects.map(s => s.category || s.type))]
  const allYears = [ALL_TAG, ...new Set(subjects.map(s => new Date(s.created_at).getFullYear().toString()))]

  // 筛选
  const filtered = subjects.filter(s => {
    const tagMatch = activeTag === ALL_TAG || (s.tags || []).includes(activeTag)
    const catMatch = activeCategory === ALL_TAG || (s.category || s.type) === activeCategory
    const yearMatch = selectedYear === ALL_TAG || new Date(s.created_at).getFullYear().toString() === selectedYear
    return tagMatch && catMatch && yearMatch
  })

  if (loading) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center text-stone-400">加载中...</div>
  )

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-lg mx-auto px-4 pt-8 pb-16">

        {/* 头部 */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-stone-800 tracking-tight">我的记录</h1>
          <p className="text-stone-400 text-sm mt-1">{user?.email}</p>
        </div>

        {/* 统计 */}
        <div className="grid grid-cols-4 gap-2 mb-8">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
            const count = subjects.filter(s => (s.category || s.type) === key).length
            return (
              <div key={key} className="bg-white rounded-xl p-3 text-center border border-stone-100">
                <div className="text-xl">{label.split(' ')[0]}</div>
                <div className="text-lg font-bold text-stone-800">{count}</div>
                <div className="text-xs text-stone-400">{label.split(' ')[1]}</div>
              </div>
            )
          })}
        </div>

        {/* 筛选区 */}
        <div className="space-y-3 mb-6">

          {/* 分类筛选 */}
          <div>
            <p className="text-xs text-stone-400 mb-1.5 font-medium">分类</p>
            <div className="flex gap-2 flex-wrap">
              {allCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all
                    ${activeCategory === cat
                      ? 'bg-stone-800 text-white'
                      : 'bg-white border border-stone-200 text-stone-500 hover:border-stone-400'
                    }`}
                >
                  {cat === ALL_TAG ? '全部' : CATEGORY_LABELS[cat] || cat}
                </button>
              ))}
            </div>
          </div>

          {/* 标签筛选 */}
          {allTags.length > 1 && (
            <div>
              <p className="text-xs text-stone-400 mb-1.5 font-medium">标签</p>
              <div className="flex gap-2 flex-wrap">
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(tag)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all
                      ${activeTag === tag
                        ? 'bg-stone-800 text-white'
                        : 'bg-white border border-stone-200 text-stone-500 hover:border-stone-400'
                      }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 年份筛选 */}
          {allYears.length > 2 && (
            <div>
              <p className="text-xs text-stone-400 mb-1.5 font-medium">年份</p>
              <div className="flex gap-2 flex-wrap">
                {allYears.map(year => (
                  <button
                    key={year}
                    onClick={() => setSelectedYear(year)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all
                      ${selectedYear === year
                        ? 'bg-stone-800 text-white'
                        : 'bg-white border border-stone-200 text-stone-500 hover:border-stone-400'
                      }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 结果数 + 新建按钮 */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-stone-400">{filtered.length} 个记录</p>
          <button
            onClick={() => navigate('/')}
            className="text-xs px-3 py-1.5 bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition-colors"
          >
            + 新建
          </button>
        </div>

        {/* 卡片网格 */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-stone-300">
            <div className="text-5xl mb-3">📭</div>
            <p className="text-sm">还没有符合条件的记录</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map(subject => (
              <button
                key={subject.id}
                onClick={() => navigate(`/subject/${subject.id}`)}
                className="bg-white rounded-2xl overflow-hidden border border-stone-100 text-left hover:border-stone-300 hover:shadow-sm active:scale-95 transition-all"
              >
                {/* 封面图 */}
                <div className="w-full h-28 bg-stone-100 overflow-hidden">
                  {subject.avatar_url
                    ? <img src={subject.avatar_url} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-4xl">
                        {subject.category === 'pet' ? '🐾' : subject.category === 'person' ? '🧑' : subject.category === 'bottle' ? '🌌' : '🪴'}
                      </div>
                  }
                </div>
                {/* 信息 */}
                <div className="p-3">
                  <p className="font-semibold text-stone-800 text-sm truncate">{subject.name}</p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {new Date(subject.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })}
                  </p>
                  {subject.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {subject.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">{tag}</span>
                      ))}
                      {subject.tags.length > 2 && (
                        <span className="text-xs text-stone-300">+{subject.tags.length - 2}</span>
                      )}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}