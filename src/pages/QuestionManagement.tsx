import { useState, useMemo } from 'react'

// 题型选项（与学习情况页面保持一致）
const QUESTION_TYPES = [
  { value: 'imitation', label: '模仿朗读' },
  { value: 'listening', label: '听选信息' },
  { value: 'answering', label: '回答问题' },
  { value: 'retelling', label: '短文复述及提问' },
] as const

// 题目类型
interface Question {
  id: string
  title: string
  mode: 'practice' | 'exam' // 练习或考试
  type: 'imitation' | 'listening' | 'answering' | 'retelling' | 'exam' // 题型，exam 表示考试（包含所有题型）
  difficulty: number // 0-1 区间，越接近1越难
}

// Mock 题目数据
const initialMockQuestions: Question[] = [
  // 练习 - 模仿朗读
  { id: 'p1', title: 'Unit 1 - 日常对话模仿朗读', mode: 'practice', type: 'imitation', difficulty: 0.3 },
  { id: 'p2', title: 'Unit 2 - 校园生活模仿朗读', mode: 'practice', type: 'imitation', difficulty: 0.4 },
  { id: 'p3', title: 'Unit 3 - 家庭话题模仿朗读', mode: 'practice', type: 'imitation', difficulty: 0.5 },
  { id: 'p4', title: 'Unit 4 - 购物场景模仿朗读', mode: 'practice', type: 'imitation', difficulty: 0.6 },
  // 练习 - 听选信息
  { id: 'p5', title: 'Unit 1 - 听短对话选图', mode: 'practice', type: 'listening', difficulty: 0.3 },
  { id: 'p6', title: 'Unit 2 - 听长对话选答案', mode: 'practice', type: 'listening', difficulty: 0.5 },
  { id: 'p7', title: 'Unit 3 - 听短文选信息', mode: 'practice', type: 'listening', difficulty: 0.7 },
  { id: 'p8', title: 'Unit 4 - 听新闻选要点', mode: 'practice', type: 'listening', difficulty: 0.8 },
  // 练习 - 回答问题
  { id: 'p9', title: 'Unit 1 - 回答简单问题', mode: 'practice', type: 'answering', difficulty: 0.4 },
  { id: 'p10', title: 'Unit 2 - 回答开放性问题', mode: 'practice', type: 'answering', difficulty: 0.6 },
  { id: 'p11', title: 'Unit 3 - 回答复杂问题', mode: 'practice', type: 'answering', difficulty: 0.8 },
  // 练习 - 短文复述及提问
  { id: 'p12', title: 'Unit 1 - 短文复述基础', mode: 'practice', type: 'retelling', difficulty: 0.5 },
  { id: 'p13', title: 'Unit 2 - 短文复述进阶', mode: 'practice', type: 'retelling', difficulty: 0.7 },
  { id: 'p14', title: 'Unit 3 - 短文复述及提问', mode: 'practice', type: 'retelling', difficulty: 0.9 },
  // 考试
  { id: 'e1', title: '期中考试 - 综合测试卷', mode: 'exam', type: 'exam', difficulty: 0.6 },
  { id: 'e2', title: '期末考试 - 综合测试卷', mode: 'exam', type: 'exam', difficulty: 0.8 },
  { id: 'e3', title: '模拟考试 - 综合测试卷', mode: 'exam', type: 'exam', difficulty: 0.7 },
  { id: 'e4', title: '单元测试 - 综合测试卷', mode: 'exam', type: 'exam', difficulty: 0.5 },
]

export default function QuestionManagement() {
  const [questions] = useState<Question[]>(initialMockQuestions)

  // 筛选条件
  const [mode, setMode] = useState<'practice' | 'exam' | 'all'>('all')
  const [questionType, setQuestionType] = useState<string>('all')

  // 分页
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // 筛选后的题目列表
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (mode !== 'all' && q.mode !== mode) return false
      if (mode === 'practice' && questionType !== 'all' && q.type !== questionType) return false
      if (mode === 'exam' && q.type !== 'exam') return false
      return true
    })
  }, [questions, mode, questionType])

  // 分页后的题目列表
  const paginatedQuestions = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    const end = start + pageSize
    return filteredQuestions.slice(start, end)
  }, [filteredQuestions, currentPage])

  const totalPages = Math.ceil(filteredQuestions.length / pageSize)

  // 难度显示格式化
  const formatDifficulty = (difficulty: number) => {
    return difficulty.toFixed(2)
  }

  // 难度颜色
  const getDifficultyColor = (difficulty: number) => {
    if (difficulty < 0.4) return '#10b981' // 绿色 - 简单
    if (difficulty < 0.7) return '#f59e0b' // 橙色 - 中等
    return '#ef4444' // 红色 - 困难
  }

  // 难度标签
  const getDifficultyLabel = (difficulty: number) => {
    if (difficulty < 0.4) return '简单'
    if (difficulty < 0.7) return '中等'
    return '困难'
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, marginBottom: 12 }}>题目管理</h2>
      <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 20 }}>
        管理桂园听说中的听力与口语题目，支持按模式、题型进行筛选，难度范围为 0-1（越接近 1 越难）。
      </p>

      {/* 筛选条件 */}
      <section
        style={{
          borderRadius: 12,
          border: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
          padding: '1.25rem 1.5rem',
          marginBottom: 20,
        }}
      >
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>筛选条件</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
          {/* 模式选择 */}
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
              模式
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setMode('all')
                  setQuestionType('all')
                  setCurrentPage(1)
                }}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  backgroundColor: mode === 'all' ? '#eff6ff' : '#ffffff',
                  color: mode === 'all' ? '#1d4ed8' : '#4b5563',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontWeight: mode === 'all' ? 600 : 400,
                }}
              >
                全部
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('practice')
                  setQuestionType('all')
                  setCurrentPage(1)
                }}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  backgroundColor: mode === 'practice' ? '#eff6ff' : '#ffffff',
                  color: mode === 'practice' ? '#1d4ed8' : '#4b5563',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontWeight: mode === 'practice' ? 600 : 400,
                }}
              >
                练习
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('exam')
                  setQuestionType('all')
                  setCurrentPage(1)
                }}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  backgroundColor: mode === 'exam' ? '#eff6ff' : '#ffffff',
                  color: mode === 'exam' ? '#1d4ed8' : '#4b5563',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontWeight: mode === 'exam' ? 600 : 400,
                }}
              >
                考试
              </button>
            </div>
          </div>

          {/* 题型选择（仅练习模式显示） */}
          {mode === 'practice' && (
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                题型
              </label>
              <select
                value={questionType}
                onChange={(e) => {
                  setQuestionType(e.target.value)
                  setCurrentPage(1)
                }}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  backgroundColor: '#ffffff',
                  fontSize: 13,
                  cursor: 'pointer',
                  minWidth: 140,
                }}
              >
                <option value="all">全部题型</option>
                {QUESTION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280' }}>
            筛选结果：<strong>{filteredQuestions.length}</strong> 道题目
          </div>
        </div>
      </section>

      {/* 题目列表 */}
      <section
        style={{
          borderRadius: 12,
          border: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ backgroundColor: '#f9fafb' }}>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.6rem 0.9rem', fontWeight: 600 }}>题目编号</th>
                <th style={{ textAlign: 'left', padding: '0.6rem 0.9rem', fontWeight: 600 }}>模式</th>
                <th style={{ textAlign: 'left', padding: '0.6rem 0.9rem', fontWeight: 600 }}>题型</th>
                <th style={{ textAlign: 'left', padding: '0.6rem 0.9rem', fontWeight: 600 }}>题目名称</th>
                <th style={{ textAlign: 'center', padding: '0.6rem 0.9rem', fontWeight: 600 }}>难度</th>
              </tr>
            </thead>
            <tbody>
              {paginatedQuestions.length > 0 ? (
                paginatedQuestions.map((question) => (
                  <tr key={question.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.6rem 0.9rem' }}>{question.id.toUpperCase()}</td>
                    <td style={{ padding: '0.6rem 0.9rem' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.6rem',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 500,
                          backgroundColor: question.mode === 'practice' ? '#dbeafe' : '#fef3c7',
                          color: question.mode === 'practice' ? '#1e40af' : '#92400e',
                        }}
                      >
                        {question.mode === 'practice' ? '练习' : '考试'}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem 0.9rem' }}>
                      {question.type === 'exam' ? (
                        <span style={{ color: '#6b7280' }}>综合测试</span>
                      ) : (
                        QUESTION_TYPES.find((t) => t.value === question.type)?.label || question.type
                      )}
                    </td>
                    <td style={{ padding: '0.6rem 0.9rem' }}>{question.title}</td>
                    <td style={{ padding: '0.6rem 0.9rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '0.2rem 0.6rem',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 500,
                            backgroundColor: getDifficultyColor(question.difficulty) + '20',
                            color: getDifficultyColor(question.difficulty),
                          }}
                        >
                          {getDifficultyLabel(question.difficulty)}
                        </span>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>
                          {formatDifficulty(question.difficulty)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div
            style={{
              padding: '1rem 1.25rem',
              borderTop: '1px solid #f3f4f6',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              共 {filteredQuestions.length} 道题目，第 {currentPage} / {totalPages} 页
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: '0.4rem 0.8rem',
                  borderRadius: 6,
                  border: '1px solid #e5e7eb',
                  backgroundColor: currentPage === 1 ? '#f9fafb' : '#ffffff',
                  color: currentPage === 1 ? '#9ca3af' : '#4b5563',
                  fontSize: 12,
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                }}
              >
                上一页
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{
                  padding: '0.4rem 0.8rem',
                  borderRadius: 6,
                  border: '1px solid #e5e7eb',
                  backgroundColor: currentPage === totalPages ? '#f9fafb' : '#ffffff',
                  color: currentPage === totalPages ? '#9ca3af' : '#4b5563',
                  fontSize: 12,
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
