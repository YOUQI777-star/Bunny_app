import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function SharePage() {
  const { token } = useParams()
  const [subject, setSubject] = useState(null)
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function fetchData() {
      const { data: s } = await supabase
        .from('subjects')
        .select('*')
        .eq('share_token', token)
        .single()
      if (!s) { setNotFound(true); setLoading(false); return }
      const { data: p } = await supabase
        .from('photos')
        .select('*')
        .eq('subject_id', s.id)
        .order('taken_at', { ascending: true })
      setSubject(s)
      setPhotos(p || [])
      setLoading(false)
    }
    fetchData()
  }, [token])

  if (loading) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center text-stone-400">加载中...</div>
  )
  if (notFound) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center text-stone-400">主页不存在</div>
  )

  const typeLabel = { pet: '宠物', person: '人物', thing: '事物', bottle: '漂流瓶' }[subject.type] || ''
  const firstDate = photos.find(p => p.taken_at)?.taken_at
  const lastDate = [...photos].reverse().find(p => p.taken_at)?.taken_at
  // 封面只取有图片的第一条记录，避免 text-only 记录导致 img src=null
  const coverPhoto = photos.find(p => p.image_url)

  return (
    <div className="min-h-screen bg-stone-50">

      {/* 封面区 */}
      <div className="relative">
        {coverPhoto && (
          <div className="w-full h-64 overflow-hidden">
            <img src={coverPhoto.image_url} className="w-full h-full object-cover" style={{ filter: 'brightness(0.75)' }} />
          </div>
        )}
        <div className={`flex flex-col items-center ${coverPhoto ? 'pb-8 -mt-16 relative z-10' : 'pt-16 pb-8'}`}>
          <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-lg bg-stone-200">
            {subject.avatar_url
              ? <img src={subject.avatar_url} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-5xl">🐾</div>
            }
          </div>
          <h1 className="mt-4 text-3xl font-bold text-stone-800 tracking-tight">{subject.name}</h1>
          <span className="text-xs text-stone-400 mt-1 bg-stone-100 px-3 py-0.5 rounded-full">{typeLabel}</span>

          {firstDate && lastDate && (
            <p className="mt-2 text-xs text-stone-400">
              {new Date(firstDate).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })}
              {firstDate !== lastDate && ` — ${new Date(lastDate).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })}`}
            </p>
          )}
        </div>
      </div>

      {/* 灵魂一句话 */}
      {subject.bio_tagline && (
        <div className="text-center px-8 mb-6">
          <p className="text-xl text-stone-700 font-medium italic">"{subject.bio_tagline}"</p>
        </div>
      )}

      {/* 正文简介 */}
      {subject.bio && (
        <div className="mx-4 max-w-lg md:mx-auto mb-8 px-6 py-5 bg-white rounded-2xl border-l-2 border-stone-300">
          <p className="text-sm text-stone-500 leading-relaxed">{subject.bio}</p>
        </div>
      )}

      {/* 时间线 */}
      {photos.length > 0 && (
        <div className="px-4 max-w-lg md:mx-auto pb-16">
          <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-4">回忆</h2>
          <div className="space-y-6">
            {photos.map(photo => (
              <div key={photo.id} className="bg-white rounded-2xl overflow-hidden border border-stone-100 shadow-sm">
                {photo.image_url
                  ? <img src={photo.image_url} className="w-full object-cover" />
                  : (
                    <div className="w-full py-6 px-4 flex items-center gap-3 bg-stone-50 border-b border-stone-100">
                      <span className="text-2xl">💬</span>
                      <p className="text-sm text-stone-600 leading-relaxed">{photo.caption}</p>
                    </div>
                  )
                }
                {(photo.taken_at || (photo.image_url && photo.caption)) && (
                  <div className="px-4 py-3">
                    {photo.taken_at && (
                      <p className="text-xs text-stone-300 mb-1">
                        {new Date(photo.taken_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    )}
                    {photo.image_url && photo.caption && (
                      <p className="text-sm text-stone-600">{photo.caption}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 底部 */}
      <div className="text-center py-8 text-xs text-stone-300">
        用邦尼日历记录 · 每一个在意的存在
      </div>
    </div>
  )
}