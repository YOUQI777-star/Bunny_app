import { useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const CATEGORY_LABELS = {
  pet: '宠物', person: '人物', thing: '事物', bottle: '漂流瓶'
}

const PRESET_TAGS = ['成长', '旅行', '日常', '工作', '家人', '朋友', '纪念', '治愈', '搞笑', '感动']

export default function CreateSubject() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const category = searchParams.get('category') || 'pet'
  const fileRef = useRef()

  const [name, setName] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [selectedTags, setSelectedTags] = useState([])
  const [customTag, setCustomTag] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  function toggleTag(tag) {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  function addCustomTag() {
    const t = customTag.trim()
    if (!t || selectedTags.includes(t)) { setCustomTag(''); return }
    setSelectedTags(prev => [...prev, t])
    setCustomTag('')
  }

  async function handleSubmit() {
    if (!name.trim()) { setError('请输入名字'); return }
    setLoading(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()

      let avatar_url = null
      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop()
        const fileName = `${user.id}/${Date.now()}.${ext}`
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
        .insert([{
          name: name.trim(),
          type: category,
          category,
          avatar_url,
          tags: selectedTags,
          user_id: user.id,
        }])
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
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">

        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-stone-800 tracking-tight">
            新建{CATEGORY_LABELS[category]}主页
          </h1>
          <p className="text-stone-400 mt-1 text-sm">为 TA 留下一个专属空间</p>
        </div>

        {/* 头像 */}
        <div className="flex justify-center mb-6">
          <button
            onClick={() => fileRef.current.click()}
            className="w-24 h-24 rounded-full overflow-hidden bg-stone-200 flex items-center justify-center border-2 border-dashed border-stone-300 hover:border-stone-400 transition-colors"
          >
            {avatarPreview
              ? <img src={avatarPreview} className="w-full h-full object-cover" />
              : <span className="text-3xl">📷</span>
            }
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>

        {/* 名字 */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wider">名字</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="叫什么名字？"
            className="w-full px-4 py-3 rounded-xl bg-white border border-stone-200 text-stone-800 placeholder-stone-300 focus:outline-none focus:border-stone-400 transition-colors"
          />
        </div>

        {/* 标签 */}
        <div className="mb-8">
          <label className="block text-xs font-semibold text-stone-500 mb-2 uppercase tracking-wider">标签</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {PRESET_TAGS.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all
                  ${selectedTags.includes(tag)
                    ? 'bg-stone-800 text-white'
                    : 'bg-white border border-stone-200 text-stone-500 hover:border-stone-400'
                  }`}
              >
                {tag}
              </button>
            ))}
          </div>

          {/* 自定义标签 */}
          <div className="flex gap-2">
            <input
              type="text"
              value={customTag}
              onChange={e => setCustomTag(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustomTag()}
              placeholder="自定义标签..."
              className="flex-1 px-3 py-2 rounded-lg bg-white border border-stone-200 text-sm text-stone-700 placeholder-stone-300 focus:outline-none focus:border-stone-400"
            />
            <button
              onClick={addCustomTag}
              className="px-3 py-2 rounded-lg bg-stone-100 text-stone-600 text-sm hover:bg-stone-200 transition-colors"
            >
              添加
            </button>
          </div>

          {/* 已选标签 */}
          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {selectedTags.map(tag => (
                <span
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className="px-3 py-1 rounded-full text-xs bg-stone-800 text-white cursor-pointer"
                >
                  {tag} ×
                </span>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-4 bg-stone-800 text-white rounded-xl font-semibold hover:bg-stone-700 active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? '创建中...' : '创建主页 →'}
        </button>

      </div>
    </div>
  )
}