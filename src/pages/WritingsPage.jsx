import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const LENS_LABELS = {
  recent_snapshot: '最近记录',
  first_impression: '最初印象',
  whole_arc: '全部记录',
  current_state: '当前状态',
}

const PAGE_SIZE = 10

export default function WritingsPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [writings, setWritings] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [subjectName, setSubjectName] = useState('')
  const [acting, setActing] = useState(null)  // writing.id being acted on

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    setLoading(true)
    const { data: subject } = await supabase.from('subjects').select('name').eq('id', id).single()
    if (subject) setSubjectName(subject.name)
    const { data } = await supabase
      .from('ai_writings')
      .select('*')
      .eq('subject_id', id)
      .order('created_at', { ascending: false })
    setWritings(data || [])
    setLoading(false)
  }

  async function toggleFavorite(writing) {
    setActing(writing.id)
    await supabase.from('ai_writings').update({ is_favorite: !writing.is_favorite }).eq('id', writing.id)
    await loadData()
    setActing(null)
  }

  async function setAsSelected(writing) {
    setActing(writing.id)
    // 清掉上一个 selected
    await supabase.from('ai_writings').update({ is_selected: false }).eq('subject_id', id).eq('is_selected', true)
    // 设置新 selected
    await supabase.from('ai_writings').update({ is_selected: true }).eq('id', writing.id)
    // 同步回写 subject
    await supabase.from('subjects').update({ bio: writing.bio, bio_tagline: writing.tagline }).eq('id', id)
    await loadData()
    setActing(null)
  }

  if (loading) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center text-stone-400">加载中...</div>
  )

  const favorites = writings.filter(w => w.is_favorite)
  const hasFavorites = favorites.length > 0
  const visibleAll = showAll ? writings : writings.slice(0, PAGE_SIZE)

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-lg mx-auto px-4 pt-8 pb-20">

        {/* 顶部 */}
        <div className="flex items-center mb-10">
          <button
            onClick={() => navigate(`/subject/${id}`)}
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >← 返回</button>
          <p className="flex-1 text-center text-xs text-stone-400 tracking-widest">整理记录</p>
          <div className="w-10" />
        </div>

        {writings.length === 0 ? (
          <p className="text-center text-stone-200 text-sm py-20">还没有整理过</p>
        ) : (
          <>
            {/* 已收藏 */}
            {hasFavorites && (
              <div className="mb-10">
                <p className="text-xs text-stone-300 mb-4 tracking-wider">已收藏</p>
                <div className="space-y-4">
                  {favorites.map(w => (
                    <WritingCard
                      key={w.id}
                      writing={w}
                      acting={acting === w.id}
                      onFavorite={toggleFavorite}
                      onSelect={setAsSelected}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 全部记录 */}
            <div>
              {hasFavorites && (
                <p className="text-xs text-stone-300 mb-4 tracking-wider">全部记录</p>
              )}
              <div className="space-y-4">
                {visibleAll.map(w => (
                  <WritingCard
                    key={w.id}
                    writing={w}
                    acting={acting === w.id}
                    onFavorite={toggleFavorite}
                    onSelect={setAsSelected}
                  />
                ))}
              </div>
              {!showAll && writings.length > PAGE_SIZE && (
                <button
                  onClick={() => setShowAll(true)}
                  className="w-full mt-6 py-3 text-xs text-stone-300 hover:text-stone-500 transition-colors"
                >查看更多（共 {writings.length} 条）</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function WritingCard({ writing, acting, onFavorite, onSelect }) {
  const date = new Date(writing.created_at).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
  const lensLabel = LENS_LABELS[writing.memory_lens] || writing.memory_lens

  return (
    <div className={`bg-white rounded-2xl border p-4 transition-opacity ${acting ? 'opacity-50' : 'border-stone-100'}`}>
      {writing.is_selected && (
        <p className="text-xs text-stone-300 mb-3 tracking-wider">当前展示中</p>
      )}
      {writing.tagline && (
        <p className="text-sm text-stone-700 italic mb-2">"{writing.tagline}"</p>
      )}
      {writing.bio && (
        <p className="text-xs text-stone-500 leading-relaxed">{writing.bio}</p>
      )}
      <div className="flex items-center justify-between mt-4">
        <p className="text-xs text-stone-300">
          {lensLabel}
          {writing.source_count ? ` · 参考 ${writing.source_count} 条` : ''}
          {` · ${date}`}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onFavorite(writing)}
            disabled={acting}
            className={`text-sm transition-colors ${writing.is_favorite ? 'text-stone-600' : 'text-stone-200 hover:text-stone-400'}`}
          >{writing.is_favorite ? '♥' : '♡'}</button>
          {!writing.is_selected && (
            <button
              onClick={() => onSelect(writing)}
              disabled={acting}
              className="text-xs text-stone-400 hover:text-stone-600 border border-stone-200 hover:border-stone-400 px-2.5 py-1 rounded-lg transition-colors"
            >设为展示</button>
          )}
        </div>
      </div>
    </div>
  )
}
