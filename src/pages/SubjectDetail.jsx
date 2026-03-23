import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY

export default function SubjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const fileRef = useRef()

  const [subject, setSubject] = useState(null)
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [pendingFile, setPendingFile] = useState(null)
  const [pendingPreview, setPendingPreview] = useState(null)
  const [caption, setCaption] = useState('')
  const [takenAt, setTakenAt] = useState('')
  const [showUploadPanel, setShowUploadPanel] = useState(false)
  const [bioLoading, setBioLoading] = useState(false)

  useEffect(() => {
    fetchData()
  }, [id])

  async function fetchData() {
    setLoading(true)
    const { data: s } = await supabase.from('subjects').select('*').eq('id', id).single()
    const { data: p } = await supabase.from('photos').select('*').eq('subject_id', id).order('taken_at', { ascending: true })
    setSubject(s)
    setPhotos(p || [])
    setLoading(false)
  }

  function handleFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setPendingFile(file)
    setPendingPreview(URL.createObjectURL(file))
    setShowUploadPanel(true)
  }

  async function handleUpload() {
    if (!pendingFile) return
    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const ext = pendingFile.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(`subjects/${id}/${fileName}`, pendingFile)
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage
        .from('photos')
        .getPublicUrl(`subjects/${id}/${fileName}`)
      await supabase.from('photos').insert([{
        subject_id: id,
        image_url: urlData.publicUrl,
        caption: caption.trim() || null,
        taken_at: takenAt || null,
      }])
      setPendingFile(null)
      setPendingPreview(null)
      setCaption('')
      setTakenAt('')
      setShowUploadPanel(false)
      fetchData()
    } catch (err) {
      alert(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleGenerateBio() {
    if (photos.length === 0) { alert('请先添加至少一张照片'); return }

    const photoSummary = photos.map((p, i) => {
      const date = p.taken_at ? new Date(p.taken_at).toLocaleDateString('zh-CN') : '某天'
      const cap = p.caption || '（无备注）'
      return `第${i + 1}张照片，时间：${date}，备注：${cap}`
    }).join('\n')

    const typeLabel = { pet: '宠物', person: '人物', thing: '事物', bottle: '漂流瓶' }[subject.type] || '对象'
    const prompt = `你是一个温情的叙述者。以下是关于一个叫「${subject.name}」的${typeLabel}的照片记录：

${photoSummary}

请根据这些记录：
1. 写一句"灵魂概括"（15字以内，有诗意，作为tagline）
2. 写一段温情的介绍（100-150字，像在介绍一个被深爱的存在）

请严格按以下JSON格式返回，不要有其他内容：
{"tagline": "xxx", "bio": "xxx"}`

    setBioLoading(true)
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.8
        })
      })
      const data = await res.json()
      const text = data.choices[0].message.content
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())

      await supabase.from('subjects').update({
        bio: parsed.bio,
        bio_tagline: parsed.tagline
      }).eq('id', id)

      await fetchData()
    } catch (err) {
      alert('生成失败：' + err.message)
    } finally {
      setBioLoading(false)
    }
  }

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

      <div className="flex flex-col items-center pt-4 pb-8 px-4">
        <div className="w-24 h-24 rounded-full overflow-hidden bg-stone-200 mb-4">
          {subject.avatar_url
            ? <img src={subject.avatar_url} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-4xl">🐾</div>
          }
        </div>
        <h1 className="text-2xl font-bold text-stone-800 tracking-tight">{subject.name}</h1>
        <span className="text-xs text-stone-400 mt-1 bg-stone-200 px-2 py-0.5 rounded-full">{typeLabel}</span>

        {subject.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2 justify-center">
            {subject.tags.map(tag => (
              <span key={tag} className="text-xs bg-stone-100 text-stone-500 px-2.5 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}

        {subject.bio_tagline && (
          <p className="mt-3 text-stone-500 text-sm italic text-center max-w-xs">"{subject.bio_tagline}"</p>
        )}
        {subject.bio && (
          <p className="mt-2 text-stone-400 text-xs text-center max-w-xs leading-relaxed">{subject.bio}</p>
        )}
        <button
          onClick={handleGenerateBio}
          disabled={bioLoading}
          className="mt-4 text-xs px-4 py-2 rounded-full border border-stone-300 text-stone-500 hover:bg-stone-100 transition-colors disabled:opacity-50"
        >
          {bioLoading ? '正在回忆...' : subject.bio ? '重新生成简介' : '生成 AI 简介'}
        </button>
        <button
          onClick={() => {
            const url = `${window.location.origin}/share/${subject.share_token}`
            navigator.clipboard.writeText(url)
            alert('分享链接已复制！')
          }}
          className="mt-2 text-xs px-4 py-2 rounded-full border border-stone-300 text-stone-500 hover:bg-stone-100 transition-colors"
        >
          🔗 复制分享链接
        </button>
      </div>

      <div className="px-4 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">记录</h2>
          <button
            onClick={() => fileRef.current.click()}
            className="text-xs bg-stone-800 text-white px-3 py-1.5 rounded-lg hover:bg-stone-700 transition-colors"
          >
            + 添加照片
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
        </div>

        {showUploadPanel && pendingPreview && (
          <div className="mb-6 bg-white rounded-2xl overflow-hidden border border-stone-200">
            <img src={pendingPreview} className="w-full max-h-64 object-cover" />
            <div className="p-4 space-y-3">
              <input
                type="text"
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="写一句话记录这个瞬间..."
                className="w-full px-3 py-2 rounded-lg bg-stone-50 border border-stone-200 text-sm text-stone-700 placeholder-stone-300 focus:outline-none focus:border-stone-400"
              />
              <input
                type="date"
                value={takenAt}
                onChange={e => setTakenAt(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-stone-50 border border-stone-200 text-sm text-stone-500 focus:outline-none focus:border-stone-400"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowUploadPanel(false); setPendingPreview(null); setPendingFile(null) }}
                  className="flex-1 py-2 rounded-lg border border-stone-200 text-sm text-stone-500 hover:bg-stone-50"
                >取消</button>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="flex-1 py-2 rounded-lg bg-stone-800 text-white text-sm font-medium hover:bg-stone-700 disabled:opacity-50"
                >{uploading ? '上传中...' : '保存'}</button>
              </div>
            </div>
          </div>
        )}

        {photos.length === 0 && !showUploadPanel && (
          <div className="text-center py-16 text-stone-300">
            <div className="text-5xl mb-3">📷</div>
            <p className="text-sm">还没有记录，添加第一张照片吧</p>
          </div>
        )}

        <div className="space-y-6 pb-16">
          {photos.map(photo => (
            <div key={photo.id} className="bg-white rounded-2xl overflow-hidden border border-stone-100">
              <img src={photo.image_url} className="w-full object-cover" />
              <div className="px-4 py-3">
                {photo.taken_at && (
                  <p className="text-xs text-stone-300 mb-1">
                    {new Date(photo.taken_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                )}
                {photo.caption && (
                  <p className="text-sm text-stone-600">{photo.caption}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}