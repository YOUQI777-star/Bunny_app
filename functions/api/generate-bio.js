export async function onRequestPost(context) {
  const OPENAI_API_KEY = context.env.OPENAI_API_KEY
  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }

  const { subject, photos } = await context.request.json()

  const typeLabel = { pet: '宠物', person: '人物', thing: '事物', bottle: '漂流瓶' }
  const type = typeLabel[subject.type] || '对象'
  const imagePhotos = photos.filter(p => p.image_url).slice(0, 6)

  const textContext = photos.map(p => {
    const date = p.taken_at
      ? new Date(p.taken_at + 'T00:00:00').toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
      : '某天'
    return p.caption ? `${date}：${p.caption}` : `${date}（无文字）`
  }).join('\n')

  const promptText = `你在帮一个人整理关于「${subject.name}」的记忆。这是一个${type}。

留下的记录（按时间）：
${textContext}
${imagePhotos.length > 0 ? '\n以下是部分照片，请结合照片和文字理解这段关系：' : ''}

请用私人、克制的语气写，像这个人写给自己看的，而不是写给陌生人看的：
1. tagline：15字以内，要有真实的情感颗粒感，不要"温暖陪伴""充满活力"这类套话，要具体
2. bio：80-120字，细节真实，有私人感，写出这个${type}独特的地方，不套模板

只返回 JSON，不要任何解释：{"tagline":"...","bio":"..."}`

  const content = [{ type: 'text', text: promptText }]
  for (const photo of imagePhotos) {
    content.push({ type: 'image_url', image_url: { url: photo.image_url, detail: 'low' } })
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content }],
      temperature: 0.85,
      max_tokens: 500,
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    return new Response(JSON.stringify({ error: data.error?.message || 'OpenAI error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }

  const raw = data.choices[0].message.content.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(raw)

  return new Response(JSON.stringify(parsed), {
    headers: { 'Content-Type': 'application/json' }
  })
}
