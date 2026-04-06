import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const CATEGORY_LABELS = {
  pet: '🐾 宠物', person: '🧑 人物', thing: '🪴 事物', bottle: '🌌 漂流瓶'
}

const ALL_TAG = '全部'

export default function Profile() {
  const navigate = useNavigate()
  const avatarFileRef = useRef()
  const momentFileRef = useRef()

  const [user, setUser] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [avatarUploading, setAvatarUploading] = useState(false)

  // 我的回声
  const [selfSubjectId, setSelfSubjectId] = useState(null)
  const [selfPhotos, setSelfPhotos] = useState([])
  const [selfLoading, setSelfLoading] = useState(false)
  const [pendingMoments, setPendingMoments] = useState([])
  const [showMomentPanel, setShowMomentPanel] = useState(false)
  const [uploadingMoment, setUploadingMoment] = useState(false)
  const [lightboxPhoto, setLightboxPhoto] = useState(null)

  const [activeTag, setActiveTag] = useState(ALL_TAG)
  const [activeCategory, setActiveCategory] = useState(ALL_TAG)
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
      loadSelfBoard(user.id)
    }
    fetchData()
  }, [])

  // 过滤掉 type: 'self'（我的回声用的内部 subject）
  const visibleSubjects = subjects.filter(s => s.type !== 'self')

  const allTags = [ALL_TAG, ...new Set(visibleSubjects.flatMap(s => s.tags || []))]
  const allCategories = [ALL_TAG, ...new Set(visibleSubjects.map(s => s.category || s.type))]
  const allYears = [ALL_TAG, ...new Set(visibleSubjects.map(s => new Date(s.created_at).getFullYear().toString()))]

  const filtered = visibleSubjects.filter(s => {
    const tagMatch = activeTag === ALL_TAG || (s.tags || []).includes(activeTag)
    const catMatch = activeCategory === ALL_TAG || (s.category || s.type) === activeCategory
    const yearMatch = selectedYear === ALL_TAG || new Date(s.created_at).getFullYear().toString() === selectedYear
    return tagMatch && catMatch && yearMatch
  })

  // ─── 头像 ──────────────────────────────────────────────────
  async function handleAvatarChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setAvatarUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(`profile/${fileName}`, file)
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage
        .from('photos')
        .getPublicUrl(`profile/${fileName}`)
      const { data } = await supabase.auth.updateUser({ data: { avatar_url: urlData.publicUrl } })
      setUser(data.user)
      e.target.value = ''
    } catch (err) {
      alert(err.message)
    } finally {
      setAvatarUploading(false)
    }
  }

  async function handleDeleteAvatar() {
    setAvatarUploading(true)
    try {
      const { data } = await supabase.auth.updateUser({ data: { avatar_url: null } })
      setUser(data.user)
    } catch (err) {
      alert(err.message)
    } finally {
      setAvatarUploading(false)
    }
  }

  // ─── 我的回声 ──────────────────────────────────────────────
  async function loadSelfBoard(userId) {
    setSelfLoading(true)
    const { data: existing } = await supabase
      .from('subjects')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'self')
      .maybeSingle()
    if (existing?.id) {
      setSelfSubjectId(existing.id)
      const { data: photos } = await supabase
        .from('photos')
        .select('*')
        .eq('subject_id', existing.id)
        .order('created_at', { ascending: false })
      setSelfPhotos(photos || [])
    }
    setSelfLoading(false)
  }

  function handleMomentFileSelect(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setPendingMoments(files.map(file => ({
      id: Math.random().toString(36).slice(2),
      file,
      preview: URL.createObjectURL(file),
      caption: '',
    })))
    setShowMomentPanel(true)
    e.target.value = ''
  }

  function updateMomentCaption(itemId, value) {
    setPendingMoments(prev => prev.map(item => item.id === itemId ? { ...item, caption: value } : item))
  }

  function removePendingMoment(itemId) {
    setPendingMoments(prev => {
      const next = prev.filter(item => item.id !== itemId)
      if (!next.length) setShowMomentPanel(false)
      return next
    })
  }

  async function handleMomentUpload() {
    if (!pendingMoments.length) return
    setUploadingMoment(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      let sid = selfSubjectId
      if (!sid) {
        const { data: created } = await supabase
          .from('subjects')
          .insert([{ user_id: user.id, name: '我的回声', type: 'self', category: 'self', tags: [] }])
          .select('id')
          .single()
        sid = created?.id
        setSelfSubjectId(sid)
      }
      for (const item of pendingMoments) {
        const ext = item.file.name.split('.').pop()
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('photos')
          .upload(`subjects/${sid}/${fileName}`, item.file)
        if (uploadError) throw uploadError
        const { data: urlData } = supabase.storage
          .from('photos')
          .getPublicUrl(`subjects/${sid}/${fileName}`)
        await supabase.from('photos').insert([{
          subject_id: sid,
          image_url: urlData.publicUrl,
          caption: item.caption.trim() || null,
          taken_at: null,
        }])
      }
      setPendingMoments([])
      setShowMomentPanel(false)
      loadSelfBoard(user.id)
    } catch (err) {
      alert(err.message)
    } finally {
      setUploadingMoment(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center text-stone-400">加载中...</div>
  )

  const avatarUrl = user?.user_metadata?.avatar_url

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-lg mx-auto px-4 pt-8 pb-16">

        {/* 头像 + 用户信息 */}
        <div className="flex items-center gap-4 mb-5 bg-white rounded-2xl p-4 border border-stone-100">
          <div className="relative flex-shrink-0">
            <button
              onClick={() => avatarFileRef.current.click()}
              disabled={avatarUploading}
              className="w-16 h-16 rounded-full overflow-hidden bg-stone-200 block"
            >
              {avatarUrl
                ? <img src={avatarUrl} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-2xl font-semibold text-stone-400">
                    {user?.email?.[0]?.toUpperCase()}
                  </div>
              }
            </button>
            {avatarUploading && (
              <div className="absolute inset-0 bg-white/70 rounded-full flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!avatarUploading && (
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-stone-700 rounded-full flex items-center justify-center text-white text-xs pointer-events-none">+</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-stone-700 truncate">{user?.email}</p>
            <div className="flex gap-3 mt-1.5">
              <button onClick={() => avatarFileRef.current.click()} disabled={avatarUploading} className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
                {avatarUrl ? '更换头像' : '上传头像'}
              </button>
              {avatarUrl && (
                <button onClick={handleDeleteAvatar} disabled={avatarUploading} className="text-xs text-red-300 hover:text-red-400 transition-colors">删除</button>
              )}
            </div>
          </div>
          <input ref={avatarFileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>

        {/* 我的回声（紧接头像卡下方）*/}
        <div className="mb-8 bg-white rounded-2xl border border-stone-100 p-4">
          <div className="flex items-end justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-stone-700">我的回声</h3>
              <p className="text-xs text-stone-400 mt-0.5">院子记录的院子</p>
            </div>
            <button
              onClick={() => momentFileRef.current.click()}
              className="text-xs text-stone-400 border border-stone-200 px-3 py-1.5 rounded-lg hover:bg-stone-100 transition-colors"
            >+ 添加</button>
          </div>
          <input ref={momentFileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleMomentFileSelect} />

          {/* 待上传预览 */}
          {showMomentPanel && pendingMoments.length > 0 && (
            <div className="mb-3 space-y-3">
              {pendingMoments.map(item => (
                <div key={item.id} className="rounded-xl border border-stone-200 overflow-hidden">
                  <div className="relative">
                    <img src={item.preview} className="w-full max-h-52 object-cover" />
                    <button
                      onClick={() => removePendingMoment(item.id)}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/50 text-white rounded-full text-xs flex items-center justify-center hover:bg-black/70"
                    >✕</button>
                  </div>
                  <div className="px-3 py-2.5 bg-stone-50">
                    <input
                      type="text"
                      value={item.caption}
                      onChange={e => updateMomentCaption(item.id, e.target.value)}
                      placeholder="一句话..."
                      className="w-full bg-transparent text-sm text-stone-700 placeholder-stone-300 focus:outline-none"
                    />
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <button onClick={() => { setShowMomentPanel(false); setPendingMoments([]) }} className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-500 hover:bg-stone-50">取消</button>
                <button onClick={handleMomentUpload} disabled={uploadingMoment} className="flex-1 py-2.5 rounded-xl bg-stone-800 text-white text-sm font-medium hover:bg-stone-700 disabled:opacity-50">
                  {uploadingMoment ? '上传中...' : `保存${pendingMoments.length > 1 ? `（${pendingMoments.length}张）` : ''}`}
                </button>
              </div>
            </div>
          )}

          {/* 照片网格 */}
          {selfLoading ? (
            <div className="py-6 text-center text-stone-300 text-sm">加载中...</div>
          ) : selfPhotos.length === 0 && !showMomentPanel ? (
            <button
              onClick={() => momentFileRef.current.click()}
              className="w-full py-8 rounded-xl border border-dashed border-stone-200 text-stone-300 text-sm hover:border-stone-300 hover:text-stone-400 transition-colors"
            >点击添加第一张照片</button>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {selfPhotos.map(photo => (
                <button
                  key={photo.id}
                  onClick={() => setLightboxPhoto(photo)}
                  className="relative overflow-hidden rounded-lg bg-stone-100 active:scale-95 transition-transform"
                >
                  <img src={photo.image_url} className="w-full aspect-square object-cover" />
                  {photo.caption && (
                    <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 bg-gradient-to-t from-black/50 to-transparent">
                      <p className="text-white text-[10px] leading-snug line-clamp-1 text-left">{photo.caption}</p>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 统计 */}
        <div className="grid grid-cols-4 gap-2 mb-8">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
            const count = visibleSubjects.filter(s => (s.category || s.type) === key).length
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
          <div>
            <p className="text-xs text-stone-400 mb-1.5 font-medium">分类</p>
            <div className="flex gap-2 flex-wrap">
              {allCategories.map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${activeCategory === cat ? 'bg-stone-800 text-white' : 'bg-white border border-stone-200 text-stone-500 hover:border-stone-400'}`}>
                  {cat === ALL_TAG ? '全部' : CATEGORY_LABELS[cat] || cat}
                </button>
              ))}
            </div>
          </div>

          {allTags.length > 1 && (
            <div>
              <p className="text-xs text-stone-400 mb-1.5 font-medium">标签</p>
              <div className="flex gap-2 flex-wrap">
                {allTags.map(tag => (
                  <button key={tag} onClick={() => setActiveTag(tag)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${activeTag === tag ? 'bg-stone-800 text-white' : 'bg-white border border-stone-200 text-stone-500 hover:border-stone-400'}`}>
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {allYears.length > 2 && (
            <div>
              <p className="text-xs text-stone-400 mb-1.5 font-medium">年份</p>
              <div className="flex gap-2 flex-wrap">
                {allYears.map(year => (
                  <button key={year} onClick={() => setSelectedYear(year)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${selectedYear === year ? 'bg-stone-800 text-white' : 'bg-white border border-stone-200 text-stone-500 hover:border-stone-400'}`}>
                    {year}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-stone-400">{filtered.length} 个记录</p>
          <button onClick={() => navigate('/')} className="text-xs px-3 py-1.5 bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition-colors">+ 新建</button>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-stone-300">
            <div className="text-5xl mb-3">📭</div>
            <p className="text-sm">还没有符合条件的记录</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map(subject => (
              <button key={subject.id} onClick={() => navigate(`/subject/${subject.id}`)}
                className="bg-white rounded-2xl overflow-hidden border border-stone-100 text-left hover:border-stone-300 hover:shadow-sm active:scale-95 transition-all">
                <div className="w-full h-28 bg-stone-100 overflow-hidden">
                  {subject.avatar_url
                    ? <img src={subject.avatar_url} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-4xl">
                        {subject.category === 'pet' ? '🐾' : subject.category === 'person' ? '🧑' : subject.category === 'bottle' ? '🌌' : '🪴'}
                      </div>
                  }
                </div>
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
                      {subject.tags.length > 2 && <span className="text-xs text-stone-300">+{subject.tags.length - 2}</span>}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 灯箱 */}
      {lightboxPhoto && (
        <div className="fixed inset-0 z-50 bg-black/92 flex flex-col items-center justify-center" onClick={() => setLightboxPhoto(null)}>
          <button className="absolute top-5 right-5 text-white/60 hover:text-white text-3xl leading-none" onClick={() => setLightboxPhoto(null)}>×</button>
          <img src={lightboxPhoto.image_url} className="max-w-full max-h-[80vh] object-contain px-4 rounded-lg" />
          {lightboxPhoto.caption && (
            <p className="text-white/80 text-sm mt-5 text-center px-8 max-w-sm leading-relaxed">{lightboxPhoto.caption}</p>
          )}
        </div>
      )}
    </div>
  )
}
