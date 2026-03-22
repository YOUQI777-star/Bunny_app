import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const TYPES = [
  { value: 'pet', label: '宠物', emoji: '🐾' },
  { value: 'person', label: '人物', emoji: '🧑' },
  { value: 'object', label: '物品', emoji: '🪴' },
]

export default function CreateSubject() {
  const navigate = useNavigate()
  const fileRef = useRef()
  const [name, setName] = useState('')
  const [type, setType] = useState('pet')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function handleSubmit() {
    if (!name.trim()) { setError('请输入名字'); return }
    setLoading(true)
    setError('')
    try {
      let avatar_url = null
      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop()
        const fileName = `${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('photos')
          .upload(`avatars/${fileName}`, avatarFile)
        if (uploadError) throw uploadError
        const { data: urlData } = supabase.storage
          .from('photos')
          .getPublicUrl(`avatars/${fileName}`)
        avatar_url = urlData.publicUrl
      }
      const { data, error: insertError } = await supabase
        .from('subjects')
        .insert([{ name: name.trim(), type, avatar_url }])
        .select()
        .single()
      if (insertError) throw insertError
      navigate(`/subject/${data.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-stone-800 tracking-tight">新建主页</h1>
          <p className="text-stone-400 mt-2 text-sm">为你在意的存在，留下一个专属空间</p>
        </div>
        <div className="flex justify-center mb-8">
          <button
            onClick={() => fileRef.current.click()}
            className="w-28 h-28 rounded-full overflow-hidden bg-stone-200 flex items-center justify-center border-2 border-dashed border-stone-300 hover:border-stone-400 transition-colors"
          >
            {avatarPreview
              ? <img src={avatarPreview} className="w-full h-full object-cover" />
              : <span className="text-4xl">📷</span>
            }
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>
        <div className="mb-5">
          <label className="block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wider">名字</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="叫什么名字？"
            className="w-full px-4 py-3 rounded-xl bg-white border border-stone-200 text-stone-800 placeholder-stone-300 focus:outline-none focus:border-stone-400 transition-colors text-base"
          />
        </div>
        <div className="mb-8">
          <label className="block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wider">类型</label>
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className={`py-3 rounded-xl border text-sm font-medium transition-all flex flex-col items-center gap-1
                  ${type === t.value
                    ? 'border-stone-800 bg-stone-800 text-white'
                    : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                  }`}
              >
                <span className="text-xl">{t.emoji}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-4 bg-stone-800 text-white rounded-xl font-semibold text-base hover:bg-stone-700 active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? '创建中...' : '创建主页 →'}
        </button>
      </div>
    </div>
  )
}