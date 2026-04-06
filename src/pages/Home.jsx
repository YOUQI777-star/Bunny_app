import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const CATEGORIES = [
  { value: 'pet',     emoji: '🐾', label: '宠物',  desc: '毛茸茸的家人' },
  { value: 'person',  emoji: '🧑', label: '人物',  desc: '值得记住的人' },
  { value: 'thing',   emoji: '🪴', label: '事物',  desc: '有故事的存在' },
  { value: 'bottle',  emoji: '🌌', label: '漂流瓶', desc: '都丢进星空大海里' },
]

export default function Home() {
  const navigate = useNavigate()
  const momentFileRef = useRef()

  const [user, setUser] = useState(null)

  // ② 个人照片板
  const [selfSubjectId, setSelfSubjectId] = useState(null)
  const [selfPhotos, setSelfPhotos] = useState([])
  const [selfLoading, setSelfLoading] = useState(false)
  const [pendingMoments, setPendingMoments] = useState([]) // [{id, file, preview, caption}]
  const [showMomentPanel, setShowMomentPanel] = useState(false)
  const [uploadingMoment, setUploadingMoment] = useState(false)

  // 灯箱
  const [lightboxPhoto, setLightboxPhoto] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) loadSelfBoard(user.id)
    })
  }, [])

  // 加载个人照片板（不自动创建 subject，第一次上传时才懒创建）
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

  function handleCategoryClick(category) {
    if (!user) { navigate('/auth'); return }
    navigate(`/create?category=${category}`)
  }

  // ─── 个人板块：文件选择 ────────────────────────────────────
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

  // ─── 个人板块：上传（懒创建 self-subject）─────────────────
  async function handleMomentUpload() {
    if (!pendingMoments.length) return
    setUploadingMoment(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // 懒创建 self-subject
      let sid = selfSubjectId
      if (!sid) {
        const { data: created } = await supabase
          .from('subjects')
          .insert([{ user_id: user.id, name: '我的时光', type: 'self', category: 'self', tags: [] }])
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

  const avatarUrl = user?.user_metadata?.avatar_url

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-lg mx-auto px-4 pt-12 pb-16">

        {/* 欢迎语 */}
        <div className="mb-10">
          {user ? (
            <div className="flex items-center gap-3 mb-1">
              {/* ① 头像（点击跳转 profile）*/}
              <button onClick={() => navigate('/profile')} className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-stone-200">
                  {avatarUrl
                    ? <img src={avatarUrl} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-base font-semibold text-stone-400">
                        {user.email[0].toUpperCase()}
                      </div>
                  }
                </div>
              </button>
              <div>
                <h2 className="text-2xl font-bold text-stone-800 tracking-tight">人，你好 👋</h2>
                <p className="text-stone-300 text-xs italic tracking-wide">our story begins...</p>
              </div>
            </div>
          ) : (
            <h2 className="text-2xl font-bold text-stone-800 tracking-tight mb-1">开始记录</h2>
          )}
          <p className="text-stone-400 mt-1 text-sm">
            {user ? '选择一个分类，开始新的记录' : '登录后记录你在意的一切'}
          </p>
        </div>

        {/* 四个分类入口 */}
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

        {/* ② 个人照片板块 */}
        {user && (
          <div className="mt-2">
            <div className="flex items-end justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-stone-700">我的时光</h3>
                <p className="text-xs text-stone-400 mt-0.5">碎片，只属于自己的</p>
              </div>
              <button
                onClick={() => momentFileRef.current.click()}
                className="text-xs text-stone-400 border border-stone-200 px-3 py-1.5 rounded-lg hover:bg-stone-100 transition-colors"
              >
                + 添加
              </button>
            </div>
            <input
              ref={momentFileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleMomentFileSelect}
            />

            {/* 待上传预览面板 */}
            {showMomentPanel && pendingMoments.length > 0 && (
              <div className="mb-4 space-y-3">
                {pendingMoments.map(item => (
                  <div key={item.id} className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                    <div className="relative">
                      <img src={item.preview} className="w-full max-h-52 object-cover" />
                      <button
                        onClick={() => removePendingMoment(item.id)}
                        className="absolute top-2 right-2 w-7 h-7 bg-black/50 text-white rounded-full text-xs flex items-center justify-center hover:bg-black/70"
                      >✕</button>
                    </div>
                    <div className="px-3 py-2.5">
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
                  <button
                    onClick={() => { setShowMomentPanel(false); setPendingMoments([]) }}
                    className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-500 hover:bg-stone-50"
                  >取消</button>
                  <button
                    onClick={handleMomentUpload}
                    disabled={uploadingMoment}
                    className="flex-1 py-2.5 rounded-xl bg-stone-800 text-white text-sm font-medium hover:bg-stone-700 disabled:opacity-50"
                  >{uploadingMoment ? '上传中...' : `保存${pendingMoments.length > 1 ? `（${pendingMoments.length}张）` : ''}`}</button>
                </div>
              </div>
            )}

            {/* 照片网格 */}
            {selfLoading ? (
              <div className="py-10 text-center text-stone-300 text-sm">加载中...</div>
            ) : selfPhotos.length === 0 && !showMomentPanel ? (
              <button
                onClick={() => momentFileRef.current.click()}
                className="w-full py-10 rounded-2xl border border-dashed border-stone-200 text-stone-300 text-sm hover:border-stone-300 hover:text-stone-400 transition-colors"
              >
                点击添加第一张照片
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {selfPhotos.map(photo => (
                  <button
                    key={photo.id}
                    onClick={() => setLightboxPhoto(photo)}
                    className="group relative overflow-hidden rounded-xl bg-stone-100 active:scale-95 transition-transform"
                  >
                    <img
                      src={photo.image_url}
                      className="w-full aspect-square object-cover"
                    />
                    {photo.caption && (
                      <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/50 to-transparent">
                        <p className="text-white text-xs leading-snug line-clamp-2 text-left">{photo.caption}</p>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 跳转个人主页 */}
        {user && (
          <button
            onClick={() => navigate('/profile')}
            className="w-full mt-6 py-3 border border-stone-200 rounded-xl text-sm text-stone-500 hover:bg-stone-100 transition-colors"
          >
            查看我的所有记录 →
          </button>
        )}

      </div>

      {/* 灯箱 */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/92 flex flex-col items-center justify-center"
          onClick={() => setLightboxPhoto(null)}
        >
          <button
            className="absolute top-5 right-5 text-white/60 hover:text-white text-3xl leading-none"
            onClick={() => setLightboxPhoto(null)}
          >×</button>
          <img
            src={lightboxPhoto.image_url}
            className="max-w-full max-h-[80vh] object-contain px-4 rounded-lg"
          />
          {lightboxPhoto.caption && (
            <p className="text-white/80 text-sm mt-5 text-center px-8 max-w-sm leading-relaxed">
              {lightboxPhoto.caption}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
