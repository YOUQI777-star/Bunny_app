import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const TYPE_EMOJI = { pet: '🐾', person: '🧑', thing: '🪴', bottle: '🌌' }

export default function SubjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const fileRef = useRef()

  const [subject, setSubject] = useState(null)
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  // 多图上传
  const [pendingFiles, setPendingFiles] = useState([])
  const [showUploadPanel, setShowUploadPanel] = useState(false)

  // 纯文字入口
  const [showTextPanel, setShowTextPanel] = useState(false)
  const [textCaption, setTextCaption] = useState('')
  const [textTakenAt, setTextTakenAt] = useState('')

  // 分享链接 toast
  const [copySuccess, setCopySuccess] = useState(false)

  const [bioLoading, setBioLoading] = useState(false)
  const [selectedLens, setSelectedLens] = useState('whole_arc')
  const [hasWritings, setHasWritings] = useState(false)

  // ① 删除 / 编辑
  const [activeMenu, setActiveMenu] = useState(null)        // photo.id | null
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [editingPhoto, setEditingPhoto] = useState(null)
  const [editCaption, setEditCaption] = useState('')
  const [editTakenAt, setEditTakenAt] = useState('')

  // ③ 排序 + 视图
  const [sortBy, setSortBy] = useState('taken_at')     // 'taken_at' | 'created_at'
  const [viewMode, setViewMode] = useState('list')     // 'list' | 'timeline'

  useEffect(() => { fetchData() }, [id])

  // 点击外部关闭卡片操作菜单
  useEffect(() => {
    if (!activeMenu) return
    function handleOutside(e) {
      if (!e.target.closest('[data-photo-menu]')) setActiveMenu(null)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [activeMenu])

  async function fetchData() {
    setLoading(true)
    const { data: s } = await supabase.from('subjects').select('*').eq('id', id).single()
    const { data: p } = await supabase.from('photos').select('*').eq('subject_id', id).order('created_at', { ascending: true })
    const { count } = await supabase.from('ai_writings').select('id', { count: 'exact', head: true }).eq('subject_id', id)
    setSubject(s)
    setPhotos(p || [])
    setHasWritings((count || 0) > 0)
    setLoading(false)
  }

  // ─── 上传 ───────────────────────────────────────────────
  function handleFileSelect(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setPendingFiles(files.map(file => ({
      id: Math.random().toString(36).slice(2),
      file,
      preview: URL.createObjectURL(file),
      caption: '',
      takenAt: '',
    })))
    setShowUploadPanel(true)
    setShowTextPanel(false)
    e.target.value = ''
  }

  function updatePendingFile(itemId, field, value) {
    setPendingFiles(prev => prev.map(item => item.id === itemId ? { ...item, [field]: value } : item))
  }

  function removePendingFile(itemId) {
    setPendingFiles(prev => {
      const next = prev.filter(item => item.id !== itemId)
      if (!next.length) setShowUploadPanel(false)
      return next
    })
  }

  async function handleUpload() {
    if (!pendingFiles.length) return
    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      for (const item of pendingFiles) {
        const ext = item.file.name.split('.').pop()
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('photos').upload(`subjects/${id}/${fileName}`, item.file)
        if (uploadError) throw uploadError
        const { data: urlData } = supabase.storage
          .from('photos').getPublicUrl(`subjects/${id}/${fileName}`)
        await supabase.from('photos').insert([{
          subject_id: id,
          image_url: urlData.publicUrl,
          caption: item.caption.trim() || null,
          taken_at: item.takenAt || null,
        }])
      }
      setPendingFiles([])
      setShowUploadPanel(false)
      fetchData()
    } catch (err) {
      alert(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleTextUpload() {
    if (!textCaption.trim()) return
    setUploading(true)
    try {
      await supabase.from('photos').insert([{
        subject_id: id,
        image_url: null,
        caption: textCaption.trim(),
        taken_at: textTakenAt || null,
      }])
      setTextCaption('')
      setTextTakenAt('')
      setShowTextPanel(false)
      fetchData()
    } catch (err) {
      alert(err.message)
    } finally {
      setUploading(false)
    }
  }

  // ─── 编辑 ────────────────────────────────────────────────
  function startEdit(photo) {
    setEditingPhoto(photo)
    setEditCaption(photo.caption || '')
    setEditTakenAt(photo.taken_at || '')
    setActiveMenu(null)
  }

  async function handleSaveEdit(photoId) {
    setUploading(true)
    try {
      await supabase.from('photos').update({
        caption: editCaption.trim() || null,
        taken_at: editTakenAt || null,
      }).eq('id', photoId)
      setEditingPhoto(null)
      fetchData()
    } catch (err) {
      alert(err.message)
    } finally {
      setUploading(false)
    }
  }

  // ─── 删除 ────────────────────────────────────────────────
  async function handleDeletePhoto(photo) {
    setConfirmDeleteId(null)
    if (photo.image_url) {
      try {
        const marker = '/object/public/photos/'
        const idx = photo.image_url.indexOf(marker)
        if (idx !== -1) {
          await supabase.storage.from('photos').remove([photo.image_url.slice(idx + marker.length)])
        }
      } catch { /* 存储删除失败不阻塞 DB 删除 */ }
    }
    await supabase.from('photos').delete().eq('id', photo.id)
    fetchData()
  }

  // ─── ② 设为封面 ──────────────────────────────────────────
  async function handleSetCover(photo) {
    await supabase.from('subjects').update({ avatar_url: photo.image_url }).eq('id', id)
    setActiveMenu(null)
    fetchData()
  }

  // ─── 分享链接 ─────────────────────────────────────────────
  async function handleCopyLink() {
    const url = `${window.location.origin}/share/${subject.share_token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch {
      window.prompt('复制以下分享链接：', url)
    }
  }

  // ─── AI 简介 ──────────────────────────────────────────────
  async function handleGenerateBio() {
    if (photos.length === 0) { alert('请先添加至少一张照片或文字记录'); return }
    setBioLoading(true)
    try {
      const res = await fetch('/api/generate-bio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, photos, memory_lens: selectedLens }),
      })
      const result = await res.json()
      if (!res.ok || result?.error) throw new Error(result?.error || '请求失败')

      const { analysis, writing, meta } = result

      // 把之前的 is_selected 清掉
      await supabase.from('ai_writings').update({ is_selected: false }).eq('subject_id', id).eq('is_selected', true)

      // 存这次生成结果
      await supabase.from('ai_writings').insert([{
        subject_id: id,
        user_id: subject.user_id,
        memory_lens: meta.lens,
        source_count: meta.source_count,
        tagline: writing.tagline,
        bio: writing.bio,
        analysis_json: analysis,
        is_selected: true,
        is_favorite: false,
      }])

      // 同步回写 subject
      await supabase.from('subjects').update({ bio: writing.bio, bio_tagline: writing.tagline }).eq('id', id)

      await fetchData()
    } catch (err) {
      alert('生成失败：' + err.message)
    } finally {
      setBioLoading(false)
    }
  }

  // ─── ③ 排序 + 分组 ───────────────────────────────────────
  const sortedPhotos = [...photos].sort((a, b) => {
    if (sortBy === 'created_at') {
      return (a.created_at || '') < (b.created_at || '') ? -1 : 1
    }
    // taken_at 排序，null 排最后
    const aVal = a.taken_at || 'ZZZZ'
    const bVal = b.taken_at || 'ZZZZ'
    return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
  })

  function groupByMonth(list) {
    const groups = new Map()
    list.forEach(photo => {
      const rawDate = sortBy === 'taken_at' ? photo.taken_at : photo.created_at
      const key = rawDate
        ? new Date(rawDate + (rawDate.length === 10 ? 'T00:00:00' : ''))
            .toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })
        : '未标注时间'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(photo)
    })
    return [...groups.entries()]
  }

  // ─── 渲染每张卡片（列表 + 时间轴通用）─────────────────────
  function renderPhoto(photo) {
    return (
      <div key={photo.id} className="bg-white rounded-2xl border border-stone-100">
        {/* 图片/文字块：overflow-hidden + 上圆角，让图片裁剪正确，同时不遮菜单 */}
        <div className="overflow-hidden rounded-t-2xl">
          {photo.image_url
            ? <img src={photo.image_url} className="w-full object-cover" />
            : (
              <div className="w-full py-6 px-4 flex items-start gap-3 bg-stone-50">
                <span className="text-2xl mt-0.5 flex-shrink-0">💬</span>
                <p className="text-sm text-stone-600 leading-relaxed">{photo.caption}</p>
              </div>
            )
          }
        </div>

        {/* 日期 / caption / ⋯ 菜单行 */}
        <div className="px-4 py-3 flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {photo.taken_at && (
              <p className="text-xs text-stone-300 mb-1">
                {new Date(photo.taken_at + 'T00:00:00').toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            )}
            {photo.image_url && photo.caption && (
              <p className="text-sm text-stone-600 leading-relaxed">{photo.caption}</p>
            )}
          </div>

          {/* ⋯ 操作菜单 */}
          <div className="relative flex-shrink-0 -mr-1" data-photo-menu>
            <button
              onClick={() => setActiveMenu(activeMenu === photo.id ? null : photo.id)}
              className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-100 transition-colors text-base leading-none"
            >···</button>
            {activeMenu === photo.id && (
              <div className="absolute right-0 top-9 z-20 bg-white rounded-xl shadow-lg border border-stone-100 py-1 w-28 overflow-hidden">
                {photo.image_url && (
                  <button
                    onClick={() => handleSetCover(photo)}
                    className="w-full text-left px-3 py-2.5 text-xs text-stone-600 hover:bg-stone-50"
                  >🖼 设为封面</button>
                )}
                <button
                  onClick={() => startEdit(photo)}
                  className="w-full text-left px-3 py-2.5 text-xs text-stone-600 hover:bg-stone-50"
                >✏️ 编辑</button>
                <button
                  onClick={() => { setConfirmDeleteId(photo.id); setActiveMenu(null) }}
                  className="w-full text-left px-3 py-2.5 text-xs text-red-400 hover:bg-stone-50"
                >🗑 删除</button>
              </div>
            )}
          </div>
        </div>

        {/* 内联删除确认 */}
        {confirmDeleteId === photo.id && (
          <div className="px-4 pb-4 pt-3 border-t border-stone-100 flex items-center justify-between gap-3">
            <p className="text-xs text-stone-400">确认删除这条记录？</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-3 py-1.5 rounded-lg border border-stone-200 text-xs text-stone-500 hover:bg-stone-50"
              >取消</button>
              <button
                onClick={() => handleDeletePhoto(photo)}
                className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-400 hover:bg-red-100"
              >删除</button>
            </div>
          </div>
        )}

        {/* 内联编辑面板 */}
        {editingPhoto?.id === photo.id && (
          <div className="px-4 pb-4 space-y-2 border-t border-stone-100 pt-3">
            <textarea
              value={editCaption}
              onChange={e => setEditCaption(e.target.value)}
              rows={2}
              placeholder="写一句话记录这个瞬间..."
              className="w-full px-3 py-2 rounded-lg bg-stone-50 border border-stone-200 text-sm text-stone-700 placeholder-stone-300 focus:outline-none focus:border-stone-400 resize-none"
            />
            <input
              type="date"
              value={editTakenAt}
              onChange={e => setEditTakenAt(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-stone-50 border border-stone-200 text-sm text-stone-500 focus:outline-none focus:border-stone-400"
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setEditingPhoto(null)}
                className="flex-1 py-2 rounded-lg border border-stone-200 text-sm text-stone-500 hover:bg-stone-50"
              >取消</button>
              <button
                onClick={() => handleSaveEdit(photo.id)}
                disabled={uploading}
                className="flex-1 py-2 rounded-lg bg-stone-800 text-white text-sm font-medium hover:bg-stone-700 disabled:opacity-50"
              >{uploading ? '保存中...' : '保存'}</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center text-stone-400">加载中...</div>
  )
  if (!subject) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center text-stone-400">走丢了...</div>
  )

  const typeLabel = { pet: '宠物', person: '人物', thing: '事物', bottle: '漂流瓶' }[subject.type] || ''

  return (
    <div className="min-h-screen bg-stone-50">

      <div className="px-4 pt-5 pb-2">
        <button onClick={() => navigate(-1)} className="text-stone-400 text-sm hover:text-stone-600">← 返回</button>
      </div>

      {/* Subject header */}
      <div className="flex flex-col items-center pt-4 pb-8 px-4">
        <div className="w-24 h-24 rounded-full overflow-hidden bg-stone-200 mb-4">
          {subject.avatar_url
            ? <img src={subject.avatar_url} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-4xl">{TYPE_EMOJI[subject.type] || '🪴'}</div>
          }
        </div>
        <h1 className="text-2xl font-bold text-stone-800 tracking-tight">{subject.name}</h1>
        <span className="text-xs text-stone-400 mt-1 bg-stone-200 px-2 py-0.5 rounded-full">{typeLabel}</span>

        {subject.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2 justify-center">
            {subject.tags.map(tag => (
              <span key={tag} className="text-xs bg-stone-100 text-stone-500 px-2.5 py-0.5 rounded-full">{tag}</span>
            ))}
          </div>
        )}

        {subject.bio_tagline && (
          <p className="mt-3 text-stone-500 text-sm italic text-center max-w-xs">"{subject.bio_tagline}"</p>
        )}
        {subject.bio && (
          <p className="mt-2 text-stone-400 text-xs text-center max-w-xs leading-relaxed">{subject.bio}</p>
        )}

        {/* Memory Lens 选择器 */}
        <div className="mt-5 flex flex-col items-center gap-2">
          <p className="text-xs text-stone-300">生成时参考</p>
          <div className="flex gap-1.5 flex-wrap justify-center">
            {[
              { key: 'recent_snapshot', label: '最近记录' },
              { key: 'first_impression', label: '最初印象' },
              { key: 'whole_arc', label: '全部记录' },
              { key: 'current_state', label: '当前状态' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSelectedLens(key)}
                className={`text-xs px-3 py-1.5 rounded-full transition-all ${
                  selectedLens === key
                    ? 'bg-stone-700 text-white'
                    : 'bg-white border border-stone-200 text-stone-400 hover:border-stone-400'
                }`}
              >{label}</button>
            ))}
          </div>
        </div>

        <button
          onClick={handleGenerateBio}
          disabled={bioLoading}
          className="mt-3 text-xs px-4 py-2 rounded-full border border-stone-300 text-stone-500 hover:bg-stone-100 transition-colors disabled:opacity-50"
        >
          {bioLoading ? '正在回忆...' : subject.bio ? '重新生成' : '生成 AI 简介'}
        </button>
        <button
          onClick={handleCopyLink}
          className="mt-2 text-xs px-4 py-2 rounded-full border border-stone-300 text-stone-500 hover:bg-stone-100 transition-colors"
        >
          {copySuccess ? '✅ 链接已复制！' : '🔗 复制分享链接'}
        </button>
        {hasWritings && (
          <button
            onClick={() => navigate(`/subject/${id}/writings`)}
            className="mt-2 text-xs text-stone-300 hover:text-stone-500 transition-colors"
          >查看整理记录 →</button>
        )}
      </div>

      {/* 记录区 */}
      <div className="px-4 max-w-lg mx-auto">

        {/* ③ 工具栏：两行 */}
        <div className="mb-4 space-y-2">
          {/* 第一行：标题 + 视图切换 */}
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">记录</h2>
            <button
              onClick={() => setViewMode(m => m === 'list' ? 'timeline' : 'list')}
              className="text-xs text-stone-400 px-2.5 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 transition-colors"
            >
              {viewMode === 'timeline' ? '📋 列表' : '🗓 时间轴'}
            </button>
          </div>
          {/* 第二行：排序 + 添加按钮 */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              <button
                onClick={() => setSortBy('taken_at')}
                className={`text-xs px-2 py-1 rounded-lg transition-colors ${sortBy === 'taken_at' ? 'bg-stone-200 text-stone-700' : 'text-stone-400 hover:bg-stone-100'}`}
              >拍摄时间</button>
              <button
                onClick={() => setSortBy('created_at')}
                className={`text-xs px-2 py-1 rounded-lg transition-colors ${sortBy === 'created_at' ? 'bg-stone-200 text-stone-700' : 'text-stone-400 hover:bg-stone-100'}`}
              >添加时间</button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowTextPanel(true); setShowUploadPanel(false) }}
                className="text-xs border border-stone-300 text-stone-500 px-3 py-2.5 rounded-lg hover:bg-stone-100 transition-colors"
              >✏️ 文字</button>
              <button
                onClick={() => fileRef.current.click()}
                className="text-xs bg-stone-800 text-white px-3 py-2.5 rounded-lg hover:bg-stone-700 transition-colors"
              >+ 照片</button>
            </div>
          </div>
        </div>

        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />

        {/* 纯文字面板 */}
        {showTextPanel && (
          <div className="mb-6 bg-white rounded-2xl border border-stone-200 p-4 space-y-3">
            <p className="text-xs text-stone-400 font-medium">写下这个瞬间</p>
            <textarea
              value={textCaption}
              onChange={e => setTextCaption(e.target.value)}
              placeholder="今天想记录的事..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-stone-50 border border-stone-200 text-sm text-stone-700 placeholder-stone-300 focus:outline-none focus:border-stone-400 resize-none"
            />
            <input
              type="date"
              value={textTakenAt}
              onChange={e => setTextTakenAt(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-stone-50 border border-stone-200 text-sm text-stone-500 focus:outline-none focus:border-stone-400"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowTextPanel(false); setTextCaption(''); setTextTakenAt('') }}
                className="flex-1 py-2 rounded-lg border border-stone-200 text-sm text-stone-500 hover:bg-stone-50"
              >取消</button>
              <button
                onClick={handleTextUpload}
                disabled={uploading || !textCaption.trim()}
                className="flex-1 py-2 rounded-lg bg-stone-800 text-white text-sm font-medium hover:bg-stone-700 disabled:opacity-50"
              >{uploading ? '保存中...' : '保存'}</button>
            </div>
          </div>
        )}

        {/* 多图上传面板 */}
        {showUploadPanel && pendingFiles.length > 0 && (
          <div className="mb-6 space-y-4">
            {pendingFiles.map(item => (
              <div key={item.id} className="bg-white rounded-2xl overflow-hidden border border-stone-200">
                <div className="relative">
                  <img src={item.preview} className="w-full max-h-64 object-cover" />
                  <button
                    onClick={() => removePendingFile(item.id)}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/50 text-white rounded-full text-xs flex items-center justify-center hover:bg-black/70"
                  >✕</button>
                </div>
                <div className="p-4 space-y-3">
                  <input
                    type="text"
                    value={item.caption}
                    onChange={e => updatePendingFile(item.id, 'caption', e.target.value)}
                    placeholder="写一句话记录这个瞬间..."
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border border-stone-200 text-sm text-stone-700 placeholder-stone-300 focus:outline-none focus:border-stone-400"
                  />
                  <input
                    type="date"
                    value={item.takenAt}
                    onChange={e => updatePendingFile(item.id, 'takenAt', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border border-stone-200 text-sm text-stone-500 focus:outline-none focus:border-stone-400"
                  />
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowUploadPanel(false); setPendingFiles([]) }}
                className="flex-1 py-2 rounded-lg border border-stone-200 text-sm text-stone-500 hover:bg-stone-50"
              >取消</button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex-1 py-2 rounded-lg bg-stone-800 text-white text-sm font-medium hover:bg-stone-700 disabled:opacity-50"
              >{uploading ? '上传中...' : `保存${pendingFiles.length > 1 ? `（${pendingFiles.length}张）` : ''}`}</button>
            </div>
          </div>
        )}

        {/* 空态 */}
        {photos.length === 0 && !showUploadPanel && !showTextPanel && (
          <div className="text-center py-20 text-stone-300">
            <p className="text-sm">这里还空着</p>
          </div>
        )}

        {/* ③ 列表视图 */}
        {viewMode === 'list' && (
          <div className="space-y-4 pb-16">
            {sortedPhotos.map(photo => renderPhoto(photo))}
          </div>
        )}

        {/* ③ 时间轴视图 */}
        {viewMode === 'timeline' && (
          <div className="pb-16">
            {groupByMonth(sortedPhotos).map(([month, monthPhotos]) => (
              <div key={month} className="mb-8">
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-xs font-semibold text-stone-500 whitespace-nowrap">{month}</p>
                  <div className="flex-1 h-px bg-stone-100" />
                  <p className="text-xs text-stone-300 whitespace-nowrap">{monthPhotos.length} 条</p>
                </div>
                <div className="space-y-4">
                  {monthPhotos.map(photo => renderPhoto(photo))}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
