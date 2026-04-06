// ─── 工具函数 ─────────────────────────────────────────────────

function getTimestamp(photo) {
  const dt = photo.taken_at || photo.created_at
  if (!dt) return 0
  try {
    return new Date(dt.length === 10 ? dt + 'T00:00:00' : dt).getTime()
  } catch {
    return 0
  }
}

// 从候选池里取最多 maxCount 条，优先保留有 caption 的，结果按时间排回正序
function pickPreferCaption(records, maxCount) {
  if (records.length <= maxCount) return records
  const withCap = records.filter(r => r.caption)
  const withoutCap = records.filter(r => !r.caption)
  const selected = [
    ...withCap.slice(0, maxCount),
    ...withoutCap.slice(0, Math.max(0, maxCount - withCap.length)),
  ].slice(0, maxCount)
  return selected.sort((a, b) => getTimestamp(a) - getTimestamp(b))
}

// 按 memory_lens 选取参考记录
function selectRecords(photos, lens) {
  const sorted = [...photos].sort((a, b) => getTimestamp(a) - getTimestamp(b))
  const total = sorted.length
  if (total === 0) return []

  switch (lens) {
    case 'recent_snapshot': {
      // 倒序取最近 8 条，优先有文字
      const reversed = [...sorted].reverse()
      return pickPreferCaption(reversed, 8).sort((a, b) => getTimestamp(a) - getTimestamp(b))
    }

    case 'first_impression': {
      if (total <= 5) return sorted
      // 最早 30% 的记录作为候选池
      const earlyPoolEnd = Math.max(3, Math.ceil(total * 0.3))
      const earlyPool = sorted.slice(0, earlyPoolEnd * 2)
      return pickPreferCaption(earlyPool, Math.min(earlyPoolEnd, 8))
    }

    case 'whole_arc': {
      if (total <= 12) return sorted
      // 三段均匀抽样，各取 4 条
      const third = Math.floor(total / 3)
      return [
        ...pickPreferCaption(sorted.slice(0, third), 4),
        ...pickPreferCaption(sorted.slice(third, third * 2), 4),
        ...pickPreferCaption(sorted.slice(third * 2), 4),
      ].sort((a, b) => getTimestamp(a) - getTimestamp(b))
    }

    case 'current_state': {
      if (total <= 8) return sorted
      // 三段抽样，后期加权（2 + 2 + 6）
      const third = Math.floor(total / 3)
      return [
        ...pickPreferCaption(sorted.slice(0, third), 2),
        ...pickPreferCaption(sorted.slice(third, third * 2), 2),
        ...pickPreferCaption(sorted.slice(third * 2), 6),
      ].sort((a, b) => getTimestamp(a) - getTimestamp(b))
    }

    default:
      return sorted
  }
}

function formatRecords(records) {
  return records.map(r => {
    const dt = r.taken_at || r.created_at
    let dateStr = '某日'
    if (dt) {
      try {
        dateStr = new Date(dt.length === 10 ? dt + 'T00:00:00' : dt)
          .toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
      } catch { }
    }
    return r.caption ? `${dateStr}：${r.caption}` : `${dateStr}（无文字记录）`
  }).join('\n')
}

async function callOpenAI(apiKey, prompt, temperature, maxTokens) {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: maxTokens,
      }),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data.error?.message || 'OpenAI error' }
    const raw = data.choices[0].message.content
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return { ok: false, error: 'AI 返回格式异常' }
    return { ok: true, data: JSON.parse(match[0]) }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ─── Lens 提示语 ──────────────────────────────────────────────

const LENS_INSTRUCTIONS = {
  recent_snapshot: '这次只参考了最近一段记录。请重点写它近来的状态和气质，不要试图概括长期形象，不要写成完整总结。',
  first_impression: '这次参考的是最初开始记录时留下的内容。请重点写最开始它给人的印象——最初记住它的那个感觉，不需要后来发生了什么。',
  whole_arc: '这次参考了跨越整段时间的记录。请提炼较稳定、反复出现的印象，不要面面俱到，不要写成传记，重点是整体感。',
  current_state: '这次参考了整个时间线，但写作重点是：如果把这些记录连起来看，它现在更像什么样子。可以用早期和中期作为背景，但落点要在当前状态和当前气质，不要展开讲变化过程。',
}

// ─── Handler ─────────────────────────────────────────────────

export async function onRequestPost(context) {
  try {
    const OPENAI_API_KEY = context.env.OPENAI_API_KEY
    if (!OPENAI_API_KEY) return json({ error: 'OPENAI_API_KEY not configured' }, 500)

    const { subject, photos, memory_lens = 'whole_arc' } = await context.request.json()

    const typeLabel = { pet: '宠物', person: '人物', thing: '事物', bottle: '漂流瓶' }
    const type = typeLabel[subject.type] || '对象'

    // ① 选取参考记录
    const selected = selectRecords(photos, memory_lens)
    if (selected.length === 0) return json({ error: '没有可用记录' }, 400)
    const recordsText = formatRecords(selected)

    // ② 第一阶段：分析
    const analysisPrompt = `你正在阅读一些关于「${subject.name}」的记录，这是一个${type}。

记录如下：
${recordsText}

请从中提炼：
1. 反复出现的场景或状态（patterns，数组，每条不超过 15 字）
2. 最有记忆点的具体细节（details，数组，每条不超过 20 字，要具体，不要抽象）
3. 整体最适合的语气（tone，一句话描述，如"平静的熟悉感""有距离的温柔"）
4. 应该避免的表达方式（avoid，数组，如"不要写成赞美""不要用成长叙事"）

只返回 JSON，不要任何解释：{"patterns":[],"details":[],"tone":"","avoid":[]}`

    const analysisResult = await callOpenAI(OPENAI_API_KEY, analysisPrompt, 0.7, 400)
    if (!analysisResult.ok) return json({ error: analysisResult.error }, 500)
    const analysis = analysisResult.data

    // ③ 第二阶段：写作
    const lensInstruction = LENS_INSTRUCTIONS[memory_lens] || LENS_INSTRUCTIONS.whole_arc

    const writingPrompt = `你在为「${subject.name}」这个${type}写一段整理文字。

你刚刚读完它的记录，分析结果如下：
- 反复出现：${analysis.patterns?.join('、') || '无'}
- 最有记忆点的细节：${analysis.details?.join('、') || '无'}
- 语气应该是：${analysis.tone || '克制'}
- 要避免：${analysis.avoid?.join('、') || '无'}

${lensInstruction}

请从上面的分析里取材，而不是重新发挥。
写法要求：私人、克制，像这个人写给自己看的，不像对外介绍，不用讲满意义，可以留白。

1. tagline：15 字以内，从细节里来，不要抽象感受词
2. bio：80-120 字，从细节里来，不套模板

只返回 JSON：{"tagline":"","bio":""}`

    const writingResult = await callOpenAI(OPENAI_API_KEY, writingPrompt, 0.85, 400)
    if (!writingResult.ok) return json({ error: writingResult.error }, 500)

    return json({
      analysis,
      writing: writingResult.data,
      meta: { lens: memory_lens, source_count: selected.length },
    })
  } catch (err) {
    return json({ error: err.message || '未知错误' }, 500)
  }
}
