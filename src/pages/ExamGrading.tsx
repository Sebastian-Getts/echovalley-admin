/**
 * ExamGrading — whole-paper grading page (PR 5).
 *
 * Two-tier flow in one screen:
 *   1. List of active exam papers with their progress (scored / released counts).
 *   2. Once a paper is selected, list of student sessions for that paper, with
 *      per-section progress and total score. The teacher picks one session to
 *      grade.
 *
 * For per-question scoring we keep using the existing /student-answers/{id}/score
 * endpoint — only the navigation and complete/release/withdraw actions are new.
 */
import { useEffect, useMemo, useState } from 'react'
import request from '../utils/request'
import { useToast } from '../components/Toast'

// ---------- types ----------------------------------------------------------

interface ExamPaperListItem {
  id: number
  name: string
  description?: string
  total_score: number
  is_active: boolean
}

interface SectionProgress {
  section: number
  question_type: number
  section_name: string
  total_required: number
  graded_required: number
  section_score: number
  max_score: number
}

interface ExamSessionListItem {
  session_id: number
  student_name: string
  student_no: string
  student_class: string | null
  submitted_at: string | null
  grading_status: number
  section_progress: SectionProgress[]
  total_score: number | null
  graded_at: string | null
}

interface ExamSessionListResponse {
  paper: {
    id: number
    name: string
    total_score: number
    section_config: Record<string, { count: number; score: number; name: string }>
  }
  items: ExamSessionListItem[]
  total: number
}

interface SessionSectionQuestion {
  answer_record_id: number
  question_id: number
  question_title: string
  audio_urls: string[]
  required_count: number
  submitted_count: number
  current_score: number | null
  current_feedback: string | null
  paper_question_max_score: number
}

interface SessionSection {
  section: number
  section_name: string
  question_type: number
  max_score: number
  section_score: number
  questions: SessionSectionQuestion[]
}

interface SessionDetailResponse {
  session: {
    session_id: number
    student_name: string
    student_no: string
    student_class: string | null
    exam_paper_id: number
    exam_paper_name: string
    submitted_at: string | null
    grading_status: number
    overall_feedback: string | null
    graded_at: string | null
    released_at: string | null
  }
  sections: SessionSection[]
  paper_total_score: number
}

// ---------- helpers --------------------------------------------------------

const GRADING_STATUS_LABEL: Record<number, string> = {
  0: '未评分',
  1: '评分中',
  2: '评分完成',
  3: '已发布',
  4: '已撤回',
}

const GRADING_STATUS_COLOR: Record<number, { bg: string; fg: string }> = {
  0: { bg: '#f3f4f6', fg: '#6b7280' },
  1: { bg: '#fef3c7', fg: '#92400e' },
  2: { bg: '#dbeafe', fg: '#1e40af' },
  3: { bg: '#dcfce7', fg: '#166534' },
  4: { bg: '#fee2e2', fg: '#991b1b' },
}

function gradingStatusBadge(status: number) {
  const color = GRADING_STATUS_COLOR[status] || GRADING_STATUS_COLOR[0]
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.2rem 0.55rem',
        borderRadius: 999,
        backgroundColor: color.bg,
        color: color.fg,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {GRADING_STATUS_LABEL[status] || '未知'}
    </span>
  )
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('zh-CN')
  } catch {
    return iso
  }
}

// ---------- page -----------------------------------------------------------

export default function ExamGrading() {
  const toast = useToast()
  const [papers, setPapers] = useState<ExamPaperListItem[]>([])
  const [papersLoading, setPapersLoading] = useState(false)
  const [selectedPaperId, setSelectedPaperId] = useState<number | null>(null)
  const [sessionList, setSessionList] = useState<ExamSessionListResponse | null>(null)
  const [sessionListLoading, setSessionListLoading] = useState(false)
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null)
  const [sessionDetail, setSessionDetail] = useState<SessionDetailResponse | null>(null)
  const [sessionDetailLoading, setSessionDetailLoading] = useState(false)
  const [overallFeedback, setOverallFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    void loadPapers()
  }, [])

  useEffect(() => {
    if (selectedPaperId === null) {
      setSessionList(null)
      return
    }
    void loadSessions(selectedPaperId)
  }, [selectedPaperId])

  useEffect(() => {
    if (selectedSessionId === null) {
      setSessionDetail(null)
      return
    }
    void loadSessionDetail(selectedSessionId)
  }, [selectedSessionId])

  async function loadPapers() {
    setPapersLoading(true)
    try {
      const response = await request.get<{
        code: number
        data: { items: ExamPaperListItem[] }
      }>('/exam-papers', { params: { page: 1, page_size: 100, is_active: true } })
      if (response.code === 200) {
        setPapers(response.data.items)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加载试卷列表失败')
    } finally {
      setPapersLoading(false)
    }
  }

  async function loadSessions(paperId: number) {
    setSessionListLoading(true)
    setSelectedSessionId(null)
    try {
      const response = await request.get<{
        code: number
        data: ExamSessionListResponse
      }>(`/exam-grading/papers/${paperId}/sessions`)
      if (response.code === 200) {
        setSessionList(response.data)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加载学生答卷失败')
    } finally {
      setSessionListLoading(false)
    }
  }

  async function loadSessionDetail(sessionId: number) {
    setSessionDetailLoading(true)
    setOverallFeedback('')
    try {
      const response = await request.get<{
        code: number
        data: SessionDetailResponse
      }>(`/exam-grading/sessions/${sessionId}`)
      if (response.code === 200) {
        setSessionDetail(response.data)
        setOverallFeedback(response.data.session.overall_feedback ?? '')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加载学生答卷详情失败')
    } finally {
      setSessionDetailLoading(false)
    }
  }

  async function handlePerQuestionScore(
    recordId: number,
    scoreInput: string,
    maxScore: number,
    feedback: string,
  ) {
    const score = Number(scoreInput)
    if (!Number.isFinite(score) || score < 0 || score > maxScore) {
      toast.warning('请输入有效分数（0 到满分之间）')
      return
    }
    setBusy(true)
    try {
      await request.put(`/student-answers/${recordId}/score`, {
        score,
        max_score: maxScore,
        feedback: feedback || null,
      })
      toast.success('已保存该题评分')
      if (selectedPaperId !== null) {
        await loadSessions(selectedPaperId)
      }
      await loadSessionDetail(selectedSessionId!)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存评分失败')
    } finally {
      setBusy(false)
    }
  }

  async function handleComplete() {
    if (selectedSessionId === null) return
    setBusy(true)
    try {
      await request.post(
        `/exam-grading/sessions/${selectedSessionId}/complete`,
        { overall_feedback: overallFeedback || null },
      )
      toast.success('已标记评分完成')
      if (selectedPaperId !== null) {
        await loadSessions(selectedPaperId)
      }
      await loadSessionDetail(selectedSessionId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '标记完成失败')
    } finally {
      setBusy(false)
    }
  }

  async function handleRelease() {
    if (selectedSessionId === null) return
    setBusy(true)
    try {
      await request.post(`/exam-grading/sessions/${selectedSessionId}/release`)
      toast.success('已发布成绩，学生端可见')
      if (selectedPaperId !== null) {
        await loadSessions(selectedPaperId)
      }
      await loadSessionDetail(selectedSessionId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '发布失败')
    } finally {
      setBusy(false)
    }
  }

  async function handleWithdraw() {
    if (selectedSessionId === null) return
    setBusy(true)
    try {
      await request.post(`/exam-grading/sessions/${selectedSessionId}/withdraw`)
      toast.success('已撤回发布')
      if (selectedPaperId !== null) {
        await loadSessions(selectedPaperId)
      }
      await loadSessionDetail(selectedSessionId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '撤回失败')
    } finally {
      setBusy(false)
    }
  }

  async function handleExportScores() {
    if (selectedPaperId === null) return
    setExporting(true)
    try {
      const blob = await request.get<Blob>(
        `/exam-grading/papers/${selectedPaperId}/export`,
        { responseType: 'blob' },
      )
      const url = window.URL.createObjectURL(new Blob([blob]))
      const link = document.createElement('a')
      link.href = url
      link.download = `${selectedPaper?.name || 'paper'}-成绩.csv`
      link.click()
      window.URL.revokeObjectURL(url)
      toast.success('成绩表已导出')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '导出失败')
    } finally {
      setExporting(false)
    }
  }

  const totalsByPaperId = useMemo(() => {
    // Aggregated counts per paper, derived from the loaded sessionList.
    if (!sessionList) return null
    const completed = sessionList.items.filter((s) => s.grading_status === 2).length
    const released = sessionList.items.filter((s) => s.grading_status === 3).length
    const scoredAny = sessionList.items.filter(
      (s) => s.grading_status >= 1 && s.grading_status !== 0,
    ).length
    return { completed, released, scoredAny, total: sessionList.total }
  }, [sessionList])

  // ---------- render -------------------------------------------------------

  const selectedPaper = papers.find((p) => p.id === selectedPaperId) || null

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>整卷评分</h1>
        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>
          选择试卷查看学生提交情况；对每名学生依次评分、完成、发布。
        </div>
      </div>

      {/* Paper list */}
      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>试卷列表</div>
          <button
            type="button"
            onClick={() => void loadPapers()}
            disabled={papersLoading}
            style={secondaryBtnStyle}
          >
            {papersLoading ? '刷新中...' : '刷新'}
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb' }}>
                <th style={thStyle}>试卷名称</th>
                <th style={thStyle}>总分</th>
                <th style={thStyle}>状态</th>
                <th style={thStyle}>操作</th>
              </tr>
            </thead>
            <tbody>
              {papers.length === 0 && !papersLoading && (
                <tr>
                  <td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>
                    暂无可评分试卷
                  </td>
                </tr>
              )}
              {papers.map((paper) => (
                <tr
                  key={paper.id}
                  style={{
                    borderTop: '1px solid #e5e7eb',
                    backgroundColor:
                      selectedPaperId === paper.id ? '#eff6ff' : 'transparent',
                  }}
                >
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600, color: '#111827' }}>{paper.name}</div>
                    {paper.description && (
                      <div style={{ color: '#6b7280', fontSize: 12, marginTop: 3 }}>
                        {paper.description}
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>{paper.total_score} 分</td>
                  <td style={tdStyle}>
                    {paper.is_active ? (
                      <span style={{ color: '#166534' }}>已启用</span>
                    ) : (
                      <span style={{ color: '#6b7280' }}>已停用</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <button
                      type="button"
                      onClick={() => setSelectedPaperId(paper.id)}
                      style={primaryBtnStyle}
                    >
                      {selectedPaperId === paper.id ? '已选中' : '查看学生'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Sessions list */}
      {selectedPaperId !== null && (
        <section style={{ ...cardStyle, marginTop: 16 }}>
          <div style={sectionHeaderStyle}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {selectedPaper?.name} · 学生答卷
              </div>
              {totalsByPaperId && (
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                  共 {totalsByPaperId.total} 人提交 ·{' '}
                  已开始评分 {totalsByPaperId.scoredAny} 人 ·{' '}
                  已完成 {totalsByPaperId.completed} 人 ·{' '}
                  已发布 {totalsByPaperId.released} 人
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => void handleExportScores()}
              disabled={exporting}
              style={secondaryBtnStyle}
            >
              {exporting ? '导出中...' : '导出成绩 CSV'}
            </button>
          </div>

          {sessionListLoading && <div style={{ padding: 16, color: '#6b7280' }}>加载中...</div>}
          {!sessionListLoading && sessionList && sessionList.items.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>
              该试卷暂无已提交的学生答卷
            </div>
          )}

          {!sessionListLoading && sessionList && sessionList.items.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb' }}>
                    <th style={thStyle}>学生</th>
                    <th style={thStyle}>班级</th>
                    <th style={thStyle}>提交时间</th>
                    <th style={thStyle}>状态</th>
                    <th style={thStyle}>已评 / 必评</th>
                    <th style={thStyle}>总分</th>
                    <th style={thStyle}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionList.items.map((item) => {
                    const allRequired = item.section_progress.reduce(
                      (acc, p) => acc + p.total_required,
                      0,
                    )
                    const allGraded = item.section_progress.reduce(
                      (acc, p) => acc + p.graded_required,
                      0,
                    )
                    return (
                      <tr
                        key={item.session_id}
                        style={{
                          borderTop: '1px solid #e5e7eb',
                          backgroundColor:
                            selectedSessionId === item.session_id ? '#eff6ff' : 'transparent',
                        }}
                      >
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 600 }}>{item.student_name}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>
                            {item.student_no}
                          </div>
                        </td>
                        <td style={tdStyle}>{item.student_class || '—'}</td>
                        <td style={tdStyle}>{formatDateTime(item.submitted_at)}</td>
                        <td style={tdStyle}>{gradingStatusBadge(item.grading_status)}</td>
                        <td style={tdStyle}>
                          {allGraded} / {allRequired}
                        </td>
                        <td style={tdStyle}>
                          {item.total_score !== null
                            ? `${item.total_score} / ${sessionList.paper.total_score}`
                            : '—'}
                        </td>
                        <td style={tdStyle}>
                          <button
                            type="button"
                            onClick={() => setSelectedSessionId(item.session_id)}
                            style={primaryBtnStyle}
                          >
                            {selectedSessionId === item.session_id ? '已选中' : '评分'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Session detail / per-question scoring */}
      {selectedSessionId !== null && (
        <section style={{ ...cardStyle, marginTop: 16 }}>
          <div style={sectionHeaderStyle}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              {sessionDetail ? `${sessionDetail.session.student_name} 的答卷` : '加载中...'}
            </div>
            {sessionDetail && (
              <div style={{ display: 'flex', gap: 8 }}>
                {gradingStatusBadge(sessionDetail.session.grading_status)}
              </div>
            )}
          </div>

          {sessionDetailLoading && (
            <div style={{ padding: 16, color: '#6b7280' }}>加载答卷详情...</div>
          )}

          {sessionDetail && !sessionDetailLoading && (
            <>
              {sessionDetail.sections.map((section) => (
                <div key={section.section} style={{ marginTop: 18 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>
                    {section.section_name}（{section.section_score} / {section.max_score} 分）
                  </div>
                  {section.questions.map((q) => (
                    <QuestionRow
                      key={q.answer_record_id}
                      question={q}
                      locked={sessionDetail.session.grading_status === 3}
                      onScore={handlePerQuestionScore}
                      busy={busy}
                    />
                  ))}
                </div>
              ))}

              {/* Whole-paper actions */}
              <div
                style={{
                  marginTop: 24,
                  padding: '1rem',
                  backgroundColor: '#f9fafb',
                  borderRadius: 8,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 8 }}>整卷操作</div>
                <textarea
                  rows={3}
                  placeholder="整卷评语（可选）"
                  value={overallFeedback}
                  onChange={(e) => setOverallFeedback(e.target.value)}
                  disabled={busy || sessionDetail.session.grading_status === 3}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  {sessionDetail.session.grading_status === 1 && (
                    <button
                      type="button"
                      onClick={() => void handleComplete()}
                      disabled={busy}
                      style={primaryBtnStyle}
                    >
                      标记评分完成
                    </button>
                  )}
                  {sessionDetail.session.grading_status === 2 && (
                    <button
                      type="button"
                      onClick={() => void handleRelease()}
                      disabled={busy}
                      style={{ ...primaryBtnStyle, backgroundColor: '#16a34a' }}
                    >
                      发布成绩
                    </button>
                  )}
                  {sessionDetail.session.grading_status === 3 && (
                    <button
                      type="button"
                      onClick={() => void handleWithdraw()}
                      disabled={busy}
                      style={{ ...secondaryBtnStyle, color: '#991b1b', borderColor: '#fca5a5' }}
                    >
                      撤回发布
                    </button>
                  )}
                  {sessionDetail.session.grading_status === 4 && (
                    <span style={{ fontSize: 12, color: '#6b7280' }}>
                      已撤回，请修改评分后再次「标记评分完成」。
                    </span>
                  )}
                  {sessionDetail.session.graded_at && (
                    <div style={{ fontSize: 12, color: '#6b7280', marginLeft: 'auto' }}>
                      评分完成时间：{formatDateTime(sessionDetail.session.graded_at)}
                      {sessionDetail.session.released_at && (
                        <>
                          {' · '}发布时间：{formatDateTime(sessionDetail.session.released_at)}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}

// ---------- per-question row ----------------------------------------------

interface QuestionRowProps {
  question: SessionSectionQuestion
  locked: boolean
  busy: boolean
  onScore: (recordId: number, scoreInput: string, maxScore: number, feedback: string) => void
}

function QuestionRow({ question, locked, busy, onScore }: QuestionRowProps) {
  const [score, setScore] = useState(question.current_score !== null ? String(question.current_score) : '')
  const [feedback, setFeedback] = useState(question.current_feedback ?? '')

  useEffect(() => {
    setScore(question.current_score !== null ? String(question.current_score) : '')
    setFeedback(question.current_feedback ?? '')
  }, [question.current_score, question.current_feedback])

  return (
    <div
      style={{
        padding: '0.75rem 1rem',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        marginBottom: 8,
        backgroundColor: locked ? '#f9fafb' : '#ffffff',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 500, fontSize: 14 }}>
            {question.question_title}
            <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 8 }}>
              已提交 {question.submitted_count} / 应提交 {question.required_count} 段
            </span>
          </div>
          {question.audio_urls.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280' }}>
              {question.audio_urls.map((url, idx) => (
                <audio
                  key={idx}
                  controls
                  preload="none"
                  src={url}
                  style={{ height: 28, marginRight: 6 }}
                >
                  <track kind="captions" />
                </audio>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="number"
            min={0}
            max={question.paper_question_max_score}
            step={0.5}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            disabled={locked || busy}
            placeholder="分数"
            style={{
              width: 80,
              padding: '0.3rem 0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 13,
            }}
          />
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            / {question.paper_question_max_score}
          </span>
          <input
            type="text"
            placeholder="评语"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            disabled={locked || busy}
            style={{
              width: 200,
              padding: '0.3rem 0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 13,
            }}
          />
          <button
            type="button"
            onClick={() =>
              onScore(question.answer_record_id, score, question.paper_question_max_score, feedback)
            }
            disabled={locked || busy}
            style={{
              ...primaryBtnStyle,
              opacity: locked ? 0.5 : 1,
              cursor: locked ? 'not-allowed' : 'pointer',
            }}
          >
            {question.current_score !== null ? '更新' : '评分'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- styles -------------------------------------------------------

const cardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: 12,
  padding: '1rem 1.25rem',
  border: '1px solid #e5e7eb',
}

const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 12,
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.55rem 0.75rem',
  fontSize: 12,
  fontWeight: 600,
  color: '#6b7280',
}

const tdStyle: React.CSSProperties = {
  padding: '0.55rem 0.75rem',
  verticalAlign: 'top',
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '0.3rem 0.75rem',
  borderRadius: 6,
  border: '1px solid #2563eb',
  backgroundColor: '#2563eb',
  color: '#ffffff',
  fontSize: 12,
  cursor: 'pointer',
  fontWeight: 500,
}

const secondaryBtnStyle: React.CSSProperties = {
  padding: '0.3rem 0.75rem',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  backgroundColor: '#ffffff',
  color: '#374151',
  fontSize: 12,
  cursor: 'pointer',
}