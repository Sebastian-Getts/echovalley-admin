/**
 * QuestionPicker — reusable question bank picker (#9).
 *
 * The original paper form used a plain <select> per question type, which
 * becomes unusable once the bank has more than a handful of questions and
 * gives no way to check what a question actually contains before adding it
 * to a paper.
 *
 * This modal provides:
 *   - keyword search over the title
 *   - difficulty filter
 *   - inline preview: fetches /questions/{id} and renders its content
 *     fields generically (strings as text, audio URLs as players) so it
 *     works for all four question types without per-type hardcoding
 *   - explicit 选择 action that returns the id to the caller
 */
import { useEffect, useMemo, useState } from 'react'
import request from '../utils/request'

export interface PickableQuestion {
  id: string
  title: string
  difficulty: number
  difficulty_float?: number
}

interface QuestionPickerProps {
  open: boolean
  typeLabel: string
  questions: PickableQuestion[]
  selectedId: string | null
  onSelect: (id: string) => void
  onClose: () => void
}

interface PreviewField {
  label: string
  value: string
}

const AUDIO_URL_RE = /^https?:\/\/.+\.(mp3|wav|m4a|aac|ogg)(\?.*)?$/i

function isAudioUrl(value: unknown): boolean {
  return typeof value === 'string' && AUDIO_URL_RE.test(value)
}

/** Turn an arbitrary content_json into a readable list of fields. */
function flattenContent(value: unknown, prefix = ''): PreviewField[] {
  const fields: PreviewField[] = []

  if (value === null || value === undefined) return fields

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      fields.push(...flattenContent(item, `${prefix}[${index + 1}]`))
    })
    return fields
  }

  if (typeof value === 'object') {
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      const label = prefix ? `${prefix}.${key}` : key
      fields.push(...flattenContent(item, label))
    })
    return fields
  }

  const text = String(value)
  if (!text.trim()) return fields
  fields.push({ label: prefix || '值', value: text })
  return fields
}

function DifficultyStars({ difficulty }: { difficulty: number }) {
  const filled = Math.max(1, Math.min(5, Math.round(difficulty || 3)))
  return (
    <span style={{ color: '#f59e0b', fontSize: 12, letterSpacing: 1 }}>
      {'★'.repeat(filled)}
      <span style={{ color: '#d1d5db' }}>{'★'.repeat(5 - filled)}</span>
    </span>
  )
}

export default function QuestionPicker({
  open,
  typeLabel,
  questions,
  selectedId,
  onSelect,
  onClose,
}: QuestionPickerProps) {
  const [keyword, setKeyword] = useState('')
  const [difficulty, setDifficulty] = useState<'all' | number>('all')
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [previewFields, setPreviewFields] = useState<PreviewField[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')

  // Reset transient state whenever the modal is reopened.
  useEffect(() => {
    if (open) {
      setKeyword('')
      setDifficulty('all')
      setPreviewId(null)
      setPreviewFields([])
      setPreviewError('')
    }
  }, [open])

  useEffect(() => {
    if (!previewId) return
    let cancelled = false
    setPreviewLoading(true)
    setPreviewError('')
    request
      .get<{ code: number; data: Record<string, unknown> }>(
        `/questions/${previewId}`,
      )
      .then((response) => {
        if (cancelled) return
        const detail = response.data || {}
        const fields = flattenContent(detail.content_json)
        // Surface a couple of top-level facts even when content_json is empty.
        const head: PreviewField[] = []
        if (detail.title) head.push({ label: '标题', value: String(detail.title) })
        if (detail.usage_type !== undefined) {
          const usageMap: Record<string, string> = {
            '0': '未指定',
            '1': '专项练习',
            '2': '试卷',
          }
          head.push({
            label: '用途',
            value: usageMap[String(detail.usage_type)] || String(detail.usage_type),
          })
        }
        setPreviewFields([...head, ...fields])
      })
      .catch((err) => {
        if (cancelled) return
        setPreviewError(err instanceof Error ? err.message : '加载失败')
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [previewId])

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return questions.filter((q) => {
      if (kw && !q.title.toLowerCase().includes(kw)) return false
      if (difficulty !== 'all' && Math.round(q.difficulty || 3) !== difficulty) {
        return false
      }
      return true
    })
  }, [questions, keyword, difficulty])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(17, 24, 39, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 24,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 880,
          maxHeight: '86vh',
          backgroundColor: '#ffffff',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>
              从题库选择 · {typeLabel}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              共 {questions.length} 道可选，当前筛选出 {filtered.length} 道
            </div>
          </div>
          <button type="button" onClick={onClose} style={closeBtnStyle}>
            ✕
          </button>
        </div>

        {/* filters */}
        <div
          style={{
            padding: '0.75rem 1.25rem',
            borderBottom: '1px solid #f0f2f5',
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <input
            type="text"
            placeholder="按标题搜索题目..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: 200 }}
          />
          <select
            value={String(difficulty)}
            onChange={(e) =>
              setDifficulty(
                e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10),
              )
            }
            style={{ ...inputStyle, width: 140 }}
          >
            <option value="all">全部难度</option>
            {[1, 2, 3, 4, 5].map((level) => (
              <option key={level} value={level}>
                难度 {level}
              </option>
            ))}
          </select>
        </div>

        {/* list + preview */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <div
            style={{
              width: previewId ? '46%' : '100%',
              borderRight: previewId ? '1px solid #f0f2f5' : 'none',
              overflowY: 'auto',
            }}
          >
            {filtered.length === 0 && (
              <div style={{ padding: 24, color: '#9ca3af', fontSize: 13 }}>
                没有符合条件的题目
              </div>
            )}
            {filtered.map((q) => {
              const selected = q.id === selectedId
              return (
                <div
                  key={q.id}
                  style={{
                    padding: '0.7rem 1.25rem',
                    borderBottom: '1px solid #f6f7f9',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    backgroundColor: selected ? '#eff6ff' : 'transparent',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: selected ? 600 : 500,
                        color: '#111827',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {q.title || '(无标题)'}
                    </div>
                    <div style={{ marginTop: 3 }}>
                      <DifficultyStars difficulty={q.difficulty} />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewId(previewId === q.id ? null : q.id)
                    }
                    style={ghostBtnStyle}
                  >
                    {previewId === q.id ? '收起' : '预览'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(q.id)
                      onClose()
                    }}
                    style={selected ? selectedBtnStyle : primaryBtnStyle}
                  >
                    {selected ? '已选择' : '选择'}
                  </button>
                </div>
              )
            })}
          </div>

          {previewId && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
                题目预览
              </div>
              {previewLoading && (
                <div style={{ color: '#6b7280', fontSize: 13 }}>加载中...</div>
              )}
              {previewError && (
                <div style={{ color: '#991b1b', fontSize: 13 }}>
                  {previewError}
                </div>
              )}
              {!previewLoading && !previewError && previewFields.length === 0 && (
                <div style={{ color: '#9ca3af', fontSize: 13 }}>
                  该题目没有可展示的内容字段
                </div>
              )}
              {!previewLoading &&
                !previewError &&
                previewFields.map((field, index) => (
                  <div key={index} style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        fontSize: 11,
                        color: '#6b7280',
                        marginBottom: 3,
                        wordBreak: 'break-all',
                      }}
                    >
                      {field.label}
                    </div>
                    {isAudioUrl(field.value) ? (
                      <audio
                        controls
                        preload="none"
                        src={field.value}
                        style={{ height: 30, width: '100%' }}
                      >
                        <track kind="captions" />
                      </audio>
                    ) : (
                      <div
                        style={{
                          fontSize: 13,
                          color: '#111827',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          backgroundColor: '#f9fafb',
                          borderRadius: 6,
                          padding: '0.5rem 0.65rem',
                        }}
                      >
                        {field.value}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* footer */}
        <div
          style={{
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button type="button" onClick={onClose} style={ghostBtnStyle}>
            取消
          </button>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '0.45rem 0.7rem',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  fontSize: 13,
}

const closeBtnStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  fontSize: 16,
  color: '#6b7280',
  cursor: 'pointer',
  lineHeight: 1,
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '0.3rem 0.75rem',
  borderRadius: 6,
  border: '1px solid #2563eb',
  backgroundColor: '#2563eb',
  color: '#ffffff',
  fontSize: 12,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const selectedBtnStyle: React.CSSProperties = {
  ...primaryBtnStyle,
  backgroundColor: '#16a34a',
  borderColor: '#16a34a',
}

const ghostBtnStyle: React.CSSProperties = {
  padding: '0.3rem 0.75rem',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  backgroundColor: '#ffffff',
  color: '#374151',
  fontSize: 12,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}
