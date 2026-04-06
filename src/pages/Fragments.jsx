import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Fragments() {
  const navigate = useNavigate()
  const fileRef = useRef()

  const [composing, setComposing] = useState(false)
  const [text, setText] = useState('')
  const [pendingFile, setPendingFile] = useState(null)
  const [pendingPreview, setPendingPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [selfSubjectId, setSelfSubjectId] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: existing } = await supabase
      .from('subjects')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', 'self')
      .maybeSingle()
    if (existing?.id) {
      setSelfSubjectId(existing.id)
      const { data: photos } = await supabase
        .from('photos')
        .select('*')
        .eq('subject_id', existing.id)
        .order('created_at', { ascending: false })
      setEntries(photos || [])
    }
    setLoading(false)
  }

  function handleFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setPendingFile(file)
    setPendingPreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  function removeFile() {
    setPendingFile(null)
    setPendingPreview(null)
  }

  async function handleSave() {
    if (!text.trim() && !pendingFile) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      let sid = selfSubjectId
      if (!sid) {
        const { data: created } = await supabase
          .from('subjects')
          .insert([{ user_id: user.id, name: '碎片', type: 'self', category: 'self', tags: [] }])
          .select('id')
          .single()
        sid = created?.id
        setSelfSubjectId(sid)
      }
      let imageUrl = null
      if (pendingFile) {
        const ext = pendingFile.name.split('.').pop()
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('photos')
          .upload(`subjects/${sid}/${fileName}`, pendingFile)
        if (uploadError) throw uploadError
        const { data: urlData } = supabase.storage
          .from('photos')
          .getPublicUrl(`subjects/${sid}/${fileName}`)
        imageUrl = urlData.publicUrl
      }
      await supabase.from('photos').insert([{
        subject_id: sid,
        image_url: imageUrl,
        caption: text.trim() || null,
        taken_at: null,
      }])
      setText('')
      setPendingFile(null)
      setPendingPreview(null)
      setComposing(false)
      loadData()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-lg mx-auto px-4 pt-8 pb-20">

        {/* 顶部 */}
        <div className="flex items-center mb-10">
          <button onClick={() => navigate('/profile')} className="text-xs text-stone-400 hover:text-stone-600 transition-colors">← 返回</button>
          <p className="flex-1 text-center text-xs text-stone-400 tracking-widest">碎片</p>
          <div className="w-10" />
        </div>

        {/* 输入区 */}
        <div className="mb-10">
          {!composing ? (
            <button
              onClick={() => setComposing(true)}
              className="w-full text-left text-stone-300 text-sm py-3 border-b border-stone-100 hover:text-stone-400 transition-colors"
            >
              ...
            </button>
          ) : (
            <div>
              {pendingPreview && (
                <div className="relative mb-3 rounded-lg overflow-hidden">
                  <img src={pendingPreview} className="w-full max-h-64 object-cover" />
                  <button
                    onClick={removeFile}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/50 text-white rounded-full text-xs flex items-center justify-center"
                  >✕</button>
                </div>
              )}
              <textarea
                autoFocus
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="写点什么..."
                rows={4}
                className="w-full bg-transparent text-sm text-stone-700 placeholder-stone-300 resize-none focus:outline-none border-b border-stone-100 pb-3 mb-3"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => fileRef.current.click()}
                    className="text-xs text-stone-300 hover:text-stone-500 transition-colors"
                  >图片</button>
                  <button
                    onClick={() => { setComposing(false); setText(''); removeFile() }}
                    className="text-xs text-stone-300 hover:text-stone-500 transition-colors"
                  >取消</button>
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving || (!text.trim() && !pendingFile)}
                  className="text-xs px-4 py-1.5 bg-stone-800 text-white rounded-lg hover:bg-stone-700 disabled:opacity-30 transition-all"
                >
                  {saving ? '...' : '存'}
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
            </div>
          )}
        </div>

        {/* 内容列表 */}
        {loading ? (
          <div className="text-center text-stone-300 text-xs">加载中...</div>
        ) : entries.length === 0 ? (
          <div className="text-center text-stone-200 text-sm py-16">空的</div>
        ) : (
          <div className="divide-y divide-stone-100">
            {entries.map(entry => (
              <div key={entry.id} className="py-5">
                {entry.image_url && (
                  <div className="rounded-lg overflow-hidden mb-3">
                    <img src={entry.image_url} className="w-full object-cover" />
                  </div>
                )}
                {entry.caption && (
                  <p className="text-sm text-stone-600 leading-relaxed">{entry.caption}</p>
                )}
                <p className="text-xs text-stone-300 mt-2">
                  {new Date(entry.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
