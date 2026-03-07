import { useState, useMemo, useEffect, useRef } from 'react'
import request from '../utils/request'

// API 基础路径（用于音频代理，解决 MinIO 跨域无法播放）
const getApiBase = () => {
  const base = import.meta.env.VITE_API_BASE_URL || '/api/v1'
  return base.startsWith('http') ? base.replace(/\/$/, '') : `${window.location.origin}${base.startsWith('/') ? base : '/' + base}`
}
const getAudioProxyUrl = (minioUrl: string) =>
  `${getApiBase()}/audio/proxy?url=${encodeURIComponent(minioUrl)}`

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
  difficulty: number // 1-5 整数，难度等级
  difficulty_float?: number // 0-1 区间，向后兼容
  is_active: boolean // 是否启用
  usage_type: number // 0=未指定, 1=专项练习, 2=试卷
}

// 模仿朗读表单数据
interface ImitationFormData {
  title: string
  mode: 'practice' | 'exam' | 'unset' // unset表示未指定
  type: 'imitation'
  difficulty: number
  content: string
  audio_url?: string // 语音地址，编辑时用于播放；保存时由后端按规则生成
}

// 听选信息表单数据
interface ListeningFormData {
  title: string
  mode: 'practice' | 'exam' | 'unset' // unset表示未指定
  type: 'listening'
  difficulty: number
  dialogues: Array<{
    text: string
    questions: [string, string] // 固定2个问题
    textAudioUrl?: string
    questionsAudioUrl?: [string, string] // 与 questions 一一对应
  }>
}

// 回答问题表单数据
interface AnsweringFormData {
  title: string
  mode: 'practice' | 'exam' | 'unset' // unset表示未指定
  type: 'answering'
  difficulty: number
  text: string // 短文文本内容
  questions: [string, string, string, string] // 固定4个问题
  textAudioUrl?: string
  questionsAudioUrl?: [string, string, string, string] // 与 questions 一一对应
}

// 短文复述及提问表单数据
interface RetellingFormData {
  title: string
  mode: 'practice' | 'exam' | 'unset' // unset表示未指定
  type: 'retelling'
  difficulty: number
  theme: string // 主题描述（中文）
  example: string // 示例文本内容（英文短文）
  img_url: string // 图片URL
  questions: [string, string] // 固定2个问题
  questionsAudioUrl?: [string, string] // 与 questions 一一对应
}

// 试卷表单数据
interface ExamPaperFormData {
  name: string
  description: string
  time_limit: number // 时间限制（秒）
  total_score: number // 试卷总分
  questions: {
    imitation: { questionId: number | null; score: number } // 模仿朗读题目ID和分值
    listening: { questionId: number | null; score: number } // 听选信息题目ID和分值
    answering: { questionId: number | null; score: number } // 回答问题题目ID和分值
    retelling: { questionId: number | null; score: number } // 短文复述及提问题目ID和分值
  }
}

// 旁白语音：题型前置文本中的单条（content + audio_url）
interface PrefaceItem {
  index: number
  content: string
  audio_url: string
}
// 题型旁白列表（用于「旁白语音」页签）
interface QuestionTypePreface {
  id: number
  type_code: string
  type_name: string
  items: PrefaceItem[]
}

export default function QuestionManagement() {
  // 标签页切换
  const [activeTab, setActiveTab] = useState<'questions' | 'papers' | 'preface'>('questions')
  
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(false)

  // 筛选条件（仅用于题目管理）
  const [mode] = useState<'practice' | 'exam' | 'all'>('all') // 默认显示所有，现在主要使用 usageType 筛选
  const [questionType, setQuestionType] = useState<string>('all')
  const [isActive, setIsActive] = useState<'all' | 'true' | 'false'>('all') // 是否启用筛选：all=全部, true=启用, false=禁用
  const [usageType, setUsageType] = useState<'all' | '0' | '1' | '2'>('all') // 所属类别筛选：all=全部, 0=未指定, 1=专项练习, 2=试卷

  // 分页
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // 新增/编辑题目相关状态
  const [isAdding, setIsAdding] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isViewing, setIsViewing] = useState(false)
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null)
  const [viewingQuestion, setViewingQuestion] = useState<(Question & { content_json?: any }) | null>(null)
  const [newQuestionType, setNewQuestionType] = useState<'imitation' | 'listening' | 'answering' | 'retelling' | null>(null)
  const [imitationForm, setImitationForm] = useState<ImitationFormData>({
    title: '',
    mode: 'unset', // 默认"未指定"
    type: 'imitation',
    difficulty: 3, // 1-5 整数，默认3
    content: '',
  })
  const [listeningForm, setListeningForm] = useState<ListeningFormData>({
    title: '',
    mode: 'unset', // 默认"未指定"
    type: 'listening',
    difficulty: 3, // 1-5 整数，默认3
    dialogues: [
      { text: '', questions: ['', ''] },
      { text: '', questions: ['', ''] },
      { text: '', questions: ['', ''] },
    ],
  })
  const [answeringForm, setAnsweringForm] = useState<AnsweringFormData>({
    title: '',
    mode: 'unset', // 默认"未指定"
    type: 'answering',
    difficulty: 3, // 1-5 整数，默认3
    text: '',
    questions: ['', '', '', ''],
  })
  const [retellingForm, setRetellingForm] = useState<RetellingFormData>({
    title: '',
    mode: 'unset', // 默认"未指定"
    type: 'retelling',
    difficulty: 3, // 1-5 整数，默认3
    theme: '',
    example: '',
    img_url: '',
    questions: ['', ''],
  })

  // 查看题目时播放语音
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null)
  const [audioError, setAudioError] = useState<string | null>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  // 编辑时单独生成语音：当前正在生成的项（用于禁用按钮、显示加载）
  const [generatingAudioKey, setGeneratingAudioKey] = useState<string | null>(null)

  // 试卷管理相关状态
  const [isAddingPaper, setIsAddingPaper] = useState(false)
  const [examPaperForm, setExamPaperForm] = useState<ExamPaperFormData>({
    name: '',
    description: '',
    time_limit: 1200, // 默认20分钟
    total_score: 100,
    questions: {
      imitation: { questionId: null, score: 25 },
      listening: { questionId: null, score: 25 },
      answering: { questionId: null, score: 25 },
      retelling: { questionId: null, score: 25 },
    },
  })
  const [availableQuestions, setAvailableQuestions] = useState<{
    imitation: Question[]
    listening: Question[]
    answering: Question[]
    retelling: Question[]
  }>({
    imitation: [],
    listening: [],
    answering: [],
    retelling: [],
  })

  // 加载题目列表
  useEffect(() => {
    loadQuestions()
  }, [mode, questionType, isActive, usageType])

  // 加载可用题目（用于试卷创建，只加载练习题目）；旁白语音页签加载题型旁白列表
  useEffect(() => {
    if (activeTab === 'papers') {
      loadAvailableQuestions()
    } else if (activeTab === 'preface') {
      loadPrefaceItems()
    }
  }, [activeTab])

  // 旁白语音：题型旁白列表与加载状态
  const [prefaceList, setPrefaceList] = useState<QuestionTypePreface[]>([])
  const [prefaceLoading, setPrefaceLoading] = useState(false)
  const [prefaceGeneratingKey, setPrefaceGeneratingKey] = useState<string | null>(null)

  const loadPrefaceItems = async () => {
    setPrefaceLoading(true)
    try {
      const response = (await request.get('/question-types/preface-items')) as {
        code: number
        message: string
        data: QuestionTypePreface[]
      }
      if (response?.code === 200 && Array.isArray(response.data)) {
        setPrefaceList(response.data)
      } else {
        setPrefaceList([])
      }
    } catch (e) {
      console.error('Failed to load preface items:', e)
      setPrefaceList([])
    } finally {
      setPrefaceLoading(false)
    }
  }

  const handlePrefaceGenerate = async (questionTypeId: number, itemIndex: number) => {
    const key = `${questionTypeId}-${itemIndex}`
    setPrefaceGeneratingKey(key)
    try {
      const response = (await request.post(
        `/question-types/${questionTypeId}/preface-items/${itemIndex}/synthesize`
      )) as { code: number; message: string; data?: { audio_url: string } }
      if (response?.code === 200 && response.data?.audio_url) {
        setPrefaceList((prev) =>
          prev.map((qt) =>
            qt.id === questionTypeId
              ? {
                  ...qt,
                  items: qt.items.map((it) =>
                    it.index === itemIndex ? { ...it, audio_url: response.data!.audio_url } : it
                  ),
                }
              : qt
          )
        )
      }
    } catch (e) {
      console.error('Preface synthesize failed:', e)
      alert((e as Error)?.message || '生成失败')
    } finally {
      setPrefaceGeneratingKey(null)
    }
  }

  const handlePrefacePlay = (audioUrl: string) => {
    if (!audioUrl) {
      setAudioError('暂无语音')
      return
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
    }
    setPlayingAudioUrl(audioUrl)
    setAudioError(null)
    const proxyUrl = getAudioProxyUrl(audioUrl)
    const audio = new Audio(proxyUrl)
    currentAudioRef.current = audio
    audio.play().catch((e) => {
      setAudioError(e?.message || '播放失败')
    })
    audio.onended = () => {
      setPlayingAudioUrl(null)
      currentAudioRef.current = null
    }
  }

  const loadQuestions = async () => {
    setLoading(true)
    try {
      const params: any = {
        skip: 0,
        limit: 1000, // 获取所有题目用于前端筛选
      }

      if (mode !== 'all') {
        params.mode = mode
      }
      if (mode === 'practice' && questionType !== 'all') {
        params.type = questionType
      }

      const response = (await request.get('/questions', { params })) as {
        code: number
        message: string
        data: {
          total: number
          items: Array<{
            id: number
            title: string
            mode: string
            type: string
            difficulty: number
          }>
        }
      }

      if (response && response.code === 200 && response.data) {
        // 转换API数据格式为前端使用的格式
        const formattedQuestions: Question[] = response.data.items.map((q: {
          id: number
          title: string
          mode: string
          type: string
          difficulty: number
          difficulty_float?: number
          is_active: boolean
          usage_type: number
        }) => ({
          id: q.id.toString(),
          title: q.title,
          mode: q.mode as 'practice' | 'exam',
          type: q.type as Question['type'],
          difficulty: q.difficulty || 3, // 1-5 整数，默认3
          difficulty_float: q.difficulty_float,
          is_active: q.is_active !== undefined ? q.is_active : true,
          usage_type: q.usage_type !== undefined ? q.usage_type : 0,
        }))

        setQuestions(formattedQuestions)
      }
    } catch (error) {
      console.error('Failed to load questions:', error)
      setQuestions([])
    } finally {
      setLoading(false)
    }
  }

  // 加载可用题目（用于试卷创建）
  const loadAvailableQuestions = async () => {
    try {
      // 加载所有"未指定"类别的题目（usage_type = 0），按题型分类
      const params: any = {
        skip: 0,
        limit: 1000,
      }

      const response = (await request.get('/questions', { params })) as {
        code: number
        message: string
        data: {
          total: number
          items: Array<{
            id: number
            title: string
            mode: string
            type: string
            difficulty: number
          }>
        }
      }

      if (response && response.code === 200 && response.data) {
        const formattedQuestions: Question[] = response.data.items.map((q: {
          id: number
          title: string
          mode: string
          type: string
          difficulty: number
          difficulty_float?: number
          is_active: boolean
          usage_type: number
        }) => ({
          id: q.id.toString(),
          title: q.title,
          mode: q.mode as 'practice' | 'exam',
          type: q.type as Question['type'],
          difficulty: q.difficulty || 3,
          difficulty_float: q.difficulty_float,
          is_active: q.is_active !== undefined ? q.is_active : true,
          usage_type: q.usage_type !== undefined ? q.usage_type : 0,
        }))

        // 只选择"未指定"类别（usage_type = 0）的题目，按题型分类
        const unassignedQuestions = formattedQuestions.filter((q) => q.usage_type === 0)
        setAvailableQuestions({
          imitation: unassignedQuestions.filter((q) => q.type === 'imitation'),
          listening: unassignedQuestions.filter((q) => q.type === 'listening'),
          answering: unassignedQuestions.filter((q) => q.type === 'answering'),
          retelling: unassignedQuestions.filter((q) => q.type === 'retelling'),
        })
      }
    } catch (error) {
      console.error('Failed to load available questions:', error)
      setAvailableQuestions({
        imitation: [],
        listening: [],
        answering: [],
        retelling: [],
      })
    }
  }

  // 筛选后的题目列表
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      // 模式筛选
      if (mode !== 'all' && q.mode !== mode) return false
      // 题型筛选
      if (mode === 'practice' && questionType !== 'all' && q.type !== questionType) return false
      if (mode === 'exam' && q.type !== 'exam') return false
      // 是否启用筛选
      if (isActive !== 'all') {
        const shouldBeActive = isActive === 'true'
        if (q.is_active !== shouldBeActive) return false
      }
      // 所属类别筛选
      if (usageType !== 'all') {
        const targetUsageType = parseInt(usageType)
        if (q.usage_type !== targetUsageType) return false
      }
      return true
    })
  }, [questions, mode, questionType, isActive, usageType])

  // 分页后的题目列表
  const paginatedQuestions = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    const end = start + pageSize
    return filteredQuestions.slice(start, end)
  }, [filteredQuestions, currentPage])

  const totalPages = Math.ceil(filteredQuestions.length / pageSize)


  // 难度星级显示（1-5星）
  const renderDifficultyStars = (difficulty: number) => {
    const stars = []
    const fullStars = Math.floor(difficulty)
    const hasHalfStar = difficulty - fullStars >= 0.5

    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <span key={i} style={{ color: '#fbbf24', fontSize: '14px' }}>
          ★
        </span>
      )
    }

    if (hasHalfStar && fullStars < 5) {
      stars.push(
        <span key="half" style={{ color: '#fbbf24', fontSize: '14px' }}>
          ☆
        </span>
      )
    }

    for (let i = stars.length; i < 5; i++) {
      stars.push(
        <span key={i} style={{ color: '#d1d5db', fontSize: '14px' }}>
          ★
        </span>
      )
    }

    return <div style={{ display: 'flex', gap: '2px' }}>{stars}</div>
  }

  // 难度颜色（基于1-5等级）
  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 2) return '#10b981' // 绿色 - 简单
    if (difficulty <= 3) return '#f59e0b' // 橙色 - 中等
    return '#ef4444' // 红色 - 困难
  }

  // 难度标签（基于1-5等级）
  const getDifficultyLabel = (difficulty: number) => {
    if (difficulty <= 2) return '简单'
    if (difficulty <= 3) return '中等'
    if (difficulty <= 4) return '较难'
    return '困难'
  }


  // 获取所属类别标签
  const getUsageTypeLabel = (usageType: number) => {
    if (usageType === 1) return '专项练习'
    if (usageType === 2) return '试卷'
    return '未指定'
  }

  // 获取所属类别颜色
  const getUsageTypeColor = (usageType: number) => {
    if (usageType === 1) return { bg: '#dbeafe', text: '#1e40af' } // 蓝色 - 专项练习
    if (usageType === 2) return { bg: '#fef3c7', text: '#92400e' } // 黄色 - 试卷
    return { bg: '#f3f4f6', text: '#6b7280' } // 灰色 - 未指定
  }

  // 播放语音（查看/编辑通用）。跨域/MinIO 地址通过 API 代理播放，避免 CORS；失败时设置 audioError
  const playObjectUrlRef = useRef<string | null>(null)
  const handlePlayAudio = (url: string) => {
    if (!url || !url.trim()) return
    setAudioError(null)
    // 若正在播放同一段，则停止
    if (playingAudioUrl === url) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current = null
      }
      if (playObjectUrlRef.current) {
        URL.revokeObjectURL(playObjectUrlRef.current)
        playObjectUrlRef.current = null
      }
      setPlayingAudioUrl(null)
      return
    }
    // 停止之前正在播放的
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
    }
    if (playObjectUrlRef.current) {
      URL.revokeObjectURL(playObjectUrlRef.current)
      playObjectUrlRef.current = null
    }
    setPlayingAudioUrl(url)
    const isCrossOrigin = () => {
      try {
        return new URL(url).origin !== window.location.origin
      } catch {
        return true
      }
    }
    const playWithUrl = (src: string) => {
      const audio = new Audio(src)
      currentAudioRef.current = audio
      audio.onended = () => {
        currentAudioRef.current = null
        if (playObjectUrlRef.current) {
          URL.revokeObjectURL(playObjectUrlRef.current)
          playObjectUrlRef.current = null
        }
        setPlayingAudioUrl(null)
      }
      audio.onerror = () => {
        currentAudioRef.current = null
        if (playObjectUrlRef.current) {
          URL.revokeObjectURL(playObjectUrlRef.current)
          playObjectUrlRef.current = null
        }
        setAudioError('播放失败：请检查音频地址或网络')
        setPlayingAudioUrl(null)
      }
      audio.play().catch(() => {
        currentAudioRef.current = null
        if (playObjectUrlRef.current) {
          URL.revokeObjectURL(playObjectUrlRef.current)
          playObjectUrlRef.current = null
        }
        setAudioError('播放失败：请检查音频地址或网络')
        setPlayingAudioUrl(null)
      })
    }
    if (isCrossOrigin()) {
      const token = localStorage.getItem('token')
      const proxyUrl = getAudioProxyUrl(url)
      fetch(proxyUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        .then((res) => {
          if (!res.ok) throw new Error(res.statusText)
          return res.blob()
        })
        .then((blob) => {
          const objectUrl = URL.createObjectURL(blob)
          playObjectUrlRef.current = objectUrl
          playWithUrl(objectUrl)
        })
        .catch(() => {
          setAudioError('播放失败：无法通过代理加载音频，请检查网络或登录状态')
          setPlayingAudioUrl(null)
        })
    } else {
      playWithUrl(url)
    }
  }

  // 渲染“播放语音”按钮（查看/编辑通用）。有 url 可播放，无 url 时仍显示按钮但禁用；播放中显示“播放中”，失败通过 audioError 提示
  const renderPlayButton = (audioUrl: string | undefined, label?: string) => {
    const hasUrl = !!(audioUrl && audioUrl.trim())
    const isPlaying = hasUrl && playingAudioUrl === audioUrl
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <button
          type="button"
          onClick={() => hasUrl && handlePlayAudio(audioUrl!)}
          title={hasUrl ? (label || '播放语音') : '暂无语音'}
          disabled={!hasUrl}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '0.25rem 0.5rem',
            marginLeft: 8,
            borderRadius: 6,
            border: '1px solid #3b82f6',
            backgroundColor: isPlaying ? '#3b82f6' : hasUrl ? '#ffffff' : '#f3f4f6',
            color: isPlaying ? '#fff' : hasUrl ? '#3b82f6' : '#9ca3af',
            fontSize: 12,
            cursor: hasUrl ? 'pointer' : 'not-allowed',
          }}
        >
          {isPlaying ? '⏸ 停止' : hasUrl ? '▶ 播放语音' : '▶ 暂无语音'}
        </button>
        {isPlaying && (
          <span style={{ fontSize: 11, color: '#059669', fontWeight: 500 }}>播放中</span>
        )}
      </span>
    )
  }

  // 编辑时调用后端单独生成语音，成功后回调 onGenerated(audio_url)；生成结果仅更新表单状态，保存题目时一并持久化
  const handleGenerateAudio = async (text: string, index: number, onGenerated: (url: string) => void) => {
    if (!editingQuestionId || !text?.trim()) return
    const key = `${editingQuestionId}_${index}`
    setGeneratingAudioKey(key)
    setAudioError(null)
    try {
      const res = (await request.post(`/questions/${editingQuestionId}/generate-audio`, { text: text.trim(), index })) as { data?: { audio_url?: string } }
      const url = res?.data?.audio_url
      if (url) {
        onGenerated(url)
        alert('语音生成成功，可点击播放试听。保存题目后语音地址会一并保存。')
      } else {
        alert('生成成功但未返回语音地址')
      }
    } catch (e: any) {
      alert(e?.message || '语音生成失败')
    } finally {
      setGeneratingAudioKey(null)
    }
  }

  // 编辑页：题目/试题旁的语音操作（生成语音 + 播放语音）；无题目 id 时仅显示播放 + 说明“保存时自动生成”
  const renderEditAudioActions = (
    audioUrl: string | undefined,
    options: {
      text?: string
      index?: number
      actionKey?: string
      hint?: string
    } = {}
  ) => {
    const { text = '', index = 0, actionKey = '', hint } = options
    const canGenerate = !!editingQuestionId && !!text?.trim()
    const key = editingQuestionId ? `${editingQuestionId}_${index}` : ''
    const isGenerating = !!(key && generatingAudioKey === key)
    return (
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
        {canGenerate && (
          <button
            type="button"
            disabled={isGenerating}
            onClick={() => handleGenerateAudio(text, index, (url) => {
              if (actionKey === 'imitation') setImitationForm((f) => ({ ...f, audio_url: url }))
              else if (actionKey.startsWith('listening_')) {
                const [_, di, part] = actionKey.split('_')
                const diIdx = parseInt(di, 10)
                if (part === 'text') {
                  setListeningForm((f) => {
                    const d = [...f.dialogues]
                    d[diIdx] = { ...d[diIdx], textAudioUrl: url }
                    return { ...f, dialogues: d }
                  })
                } else if (part?.startsWith('q')) {
                  const qIdx = parseInt(part.slice(1), 10)
                  setListeningForm((f) => {
                    const d = [...f.dialogues]
                    const prev = d[diIdx].questionsAudioUrl || ['', '']
                    const next = [...prev] as [string, string]
                    next[qIdx] = url
                    d[diIdx] = { ...d[diIdx], questionsAudioUrl: next }
                    return { ...f, dialogues: d }
                  })
                }
              } else if (actionKey === 'answering_text') {
                setAnsweringForm((f) => ({ ...f, textAudioUrl: url }))
              } else if (actionKey.startsWith('answering_q')) {
                const qIdx = parseInt(actionKey.slice('answering_q'.length), 10)
                setAnsweringForm((f) => {
                  const prev = f.questionsAudioUrl || ['', '', '', '']
                  const next = [...prev] as [string, string, string, string]
                  next[qIdx] = url
                  return { ...f, questionsAudioUrl: next }
                })
              } else if (actionKey.startsWith('retelling_q')) {
                const qIdx = parseInt(actionKey.slice('retelling_q'.length), 10)
                setRetellingForm((f) => {
                  const prev = f.questionsAudioUrl || ['', '']
                  const next = [...prev] as [string, string]
                  next[qIdx] = url
                  return { ...f, questionsAudioUrl: next }
                })
              }
            })}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '0.25rem 0.5rem',
              borderRadius: 6,
              border: '1px solid #059669',
              backgroundColor: isGenerating ? '#d1fae5' : '#ffffff',
              color: '#059669',
              fontSize: 12,
              cursor: isGenerating ? 'wait' : 'pointer',
            }}
          >
            {isGenerating ? '生成中…' : '🔊 生成语音'}
          </button>
        )}
        {renderPlayButton(audioUrl, '播放当前语音')}
        <span style={{ fontSize: 11, color: '#6b7280' }}>
          {hint ?? (editingQuestionId
            ? '若不单独生成，则保存时自动生成。'
            : '保存时自动生成语音。')}
        </span>
      </div>
    )
  }

  // 开始新增题目
  const handleStartAdd = (type: 'imitation' | 'listening' | 'answering' | 'retelling') => {
    setNewQuestionType(type)
    setIsAdding(true)
    setIsEditing(false)
    setEditingQuestionId(null)
    if (type === 'imitation') {
      setImitationForm({
        title: '',
        mode: 'unset',
        type: 'imitation',
        difficulty: 3, // 1-5 整数，默认3
        content: '',
      })
    } else if (type === 'listening') {
      setListeningForm({
        title: '',
        mode: 'unset',
        type: 'listening',
        difficulty: 3, // 1-5 整数，默认3
        dialogues: [
          { text: '', questions: ['', ''] },
          { text: '', questions: ['', ''] },
          { text: '', questions: ['', ''] },
        ],
      })
    } else if (type === 'answering') {
      setAnsweringForm({
        title: '',
        mode: 'unset',
        type: 'answering',
        difficulty: 3, // 1-5 整数，默认3
        text: '',
        questions: ['', '', '', ''],
      })
    } else if (type === 'retelling') {
      setRetellingForm({
        title: '',
        mode: 'unset',
        type: 'retelling',
        difficulty: 3, // 1-5 整数，默认3
        theme: '',
        example: '',
        img_url: '',
        questions: ['', ''],
      })
    }
  }

  // 查看题目
  const handleViewQuestion = async (question: Question) => {
    setIsViewing(true)
    setIsAdding(false)
    setIsEditing(false)
    
    // 加载题目详情
    try {
      const response = (await request.get(`/questions/${question.id}`)) as {
        code: number
        message: string
        data: {
          id: number
          title: string
          type: string
          difficulty: number
          content_json: any
          mode?: string
          is_active: boolean
          usage_type: number
        }
      }
      
      if (response && response.code === 200 && response.data) {
        const q = response.data
        // 更新viewingQuestion状态，包含完整的content_json
        setViewingQuestion({
          id: q.id.toString(),
          title: q.title,
          mode: (q.mode || (q.usage_type === 1 ? 'practice' : q.usage_type === 2 ? 'exam' : 'unspecified')) as 'practice' | 'exam',
          type: q.type as Question['type'],
          difficulty: q.difficulty || 3,
          difficulty_float: (q.difficulty - 1) / 4.0,
          is_active: q.is_active !== undefined ? q.is_active : true,
          usage_type: q.usage_type !== undefined ? q.usage_type : 0,
          content_json: q.content_json, // 包含完整的content_json
        })
      }
    } catch (error) {
      console.error('Failed to load question:', error)
      alert('加载题目失败')
      setIsViewing(false)
    }
  }

  // 编辑题目
  const handleEditQuestion = async (question: Question) => {
    setEditingQuestionId(question.id)
    setIsEditing(true)
    setIsAdding(false)
    
    // 根据题目的 usage_type 转换为 mode
    let mode: 'practice' | 'exam' | 'unset' = 'unset'
    if (question.usage_type === 1) mode = 'practice'
    else if (question.usage_type === 2) mode = 'exam'
    
    // 直接使用 1-5 整数难度
    const difficulty = question.difficulty || 3
    
    // 加载题目详情
    try {
      const response = (await request.get(`/questions/${question.id}`)) as {
        code: number
        message: string
        data: {
          id: number
          title: string
          type: string
          difficulty: number
          content_json: any
        }
      }
      
      if (response && response.code === 200 && response.data) {
        const q = response.data
        setNewQuestionType(q.type as 'imitation' | 'listening' | 'answering' | 'retelling')
        
        // 使用 API 返回的 difficulty（1-5 整数），如果没有则使用 question.difficulty
        const formDifficulty = q.difficulty || difficulty
        
        if (q.type === 'imitation') {
          setImitationForm({
            title: q.title,
            mode,
            type: 'imitation',
            difficulty: formDifficulty,
            content: q.content_json?.content || '',
            audio_url: q.content_json?.audio_url || '',
          })
        } else if (q.type === 'listening') {
          const dialogues = Array.isArray(q.content_json) ? q.content_json : []
          setListeningForm({
            title: q.title,
            mode,
            type: 'listening',
            difficulty: formDifficulty,
            dialogues: dialogues.map((d: any) => ({
              text: d.text?.content || '',
              questions: [
                d.questions?.[0]?.content || '',
                d.questions?.[1]?.content || '',
              ] as [string, string],
              textAudioUrl: d.text?.audio_url || '',
              questionsAudioUrl: [
                d.questions?.[0]?.audio_url || '',
                d.questions?.[1]?.audio_url || '',
              ] as [string, string],
            })),
          })
        } else if (q.type === 'answering') {
          setAnsweringForm({
            title: q.title,
            mode,
            type: 'answering',
            difficulty: formDifficulty,
            text: q.content_json?.text?.content || '',
            questions: [
              q.content_json?.questions?.[0]?.content || '',
              q.content_json?.questions?.[1]?.content || '',
              q.content_json?.questions?.[2]?.content || '',
              q.content_json?.questions?.[3]?.content || '',
            ] as [string, string, string, string],
            textAudioUrl: q.content_json?.text?.audio_url || '',
            questionsAudioUrl: [
              q.content_json?.questions?.[0]?.audio_url || '',
              q.content_json?.questions?.[1]?.audio_url || '',
              q.content_json?.questions?.[2]?.audio_url || '',
              q.content_json?.questions?.[3]?.audio_url || '',
            ] as [string, string, string, string],
          })
        } else if (q.type === 'retelling') {
          setRetellingForm({
            title: q.title,
            mode,
            type: 'retelling',
            difficulty: formDifficulty,
            theme: q.content_json?.text?.theme || '',
            example: q.content_json?.text?.example || '',
            img_url: q.content_json?.text?.img_url || '',
            questions: [
              q.content_json?.questions?.[0]?.content || '',
              q.content_json?.questions?.[1]?.content || '',
            ] as [string, string],
            questionsAudioUrl: [
              q.content_json?.questions?.[0]?.audio_url || '',
              q.content_json?.questions?.[1]?.audio_url || '',
            ] as [string, string],
          })
        }
      }
    } catch (error) {
      console.error('Failed to load question:', error)
      alert('加载题目失败')
    }
  }

  // 取消新增/编辑
  const handleCancelAdd = () => {
    setIsAdding(false)
    setIsEditing(false)
    setIsViewing(false)
    setEditingQuestionId(null)
    setViewingQuestion(null)
    setNewQuestionType(null)
  }

  // 保存新增 - 模仿朗读
  const handleSaveImitation = async () => {
    if (!imitationForm.title || !imitationForm.content) {
      alert('请填写完整信息')
      return
    }

    try {
      const contentJson = {
        content: imitationForm.content,
        audio_url: imitationForm.audio_url || '', // 后端规则：无语音则生成，文本有修改则重新生成
      }

      const requestData: any = {
        title: imitationForm.title,
        type: 'imitation',
        difficulty: imitationForm.difficulty,
        content_json: contentJson,
      }
      
      // 在编辑模式下总是传递 mode，以便正确更新 usage_type
      // 在新增模式下，如果 mode 是 'unset' 则不传递（使用默认值）
      if (isEditing || imitationForm.mode !== 'unset') {
        requestData.mode = imitationForm.mode
      }

      if (isEditing && editingQuestionId) {
        await request.put(`/questions/${editingQuestionId}`, requestData)
      } else {
        await request.post('/questions', requestData)
      }

      await loadQuestions()
      handleCancelAdd()
    } catch (err: any) {
      alert(err.message || '创建失败')
    }
  }

  // 保存新增 - 听选信息
  const handleSaveListening = async () => {
    if (!listeningForm.title) {
      alert('请填写题目标题')
      return
    }

    // 验证所有对话和问题都已填写
    const hasEmpty = listeningForm.dialogues.some(
      (d) => !d.text || !d.questions[0] || !d.questions[1]
    )
    if (hasEmpty) {
      alert('请填写所有对话内容和问题')
      return
    }

    try {
      const contentJson = listeningForm.dialogues.map((dialogue) => ({
        text: {
          content: dialogue.text,
          audio_url: dialogue.textAudioUrl || '',
        },
        questions: (dialogue.questionsAudioUrl ?? dialogue.questions.map(() => '')).map((url, i) => ({
          content: dialogue.questions[i],
          audio_url: url || '',
        })),
      }))

      const requestData: any = {
        title: listeningForm.title,
        type: 'listening',
        difficulty: listeningForm.difficulty,
        content_json: contentJson,
      }
      
      // 在编辑模式下总是传递 mode，以便正确更新 usage_type
      // 在新增模式下，如果 mode 是 'unset' 则不传递（使用默认值）
      if (isEditing || listeningForm.mode !== 'unset') {
        requestData.mode = listeningForm.mode
      }

      if (isEditing && editingQuestionId) {
        await request.put(`/questions/${editingQuestionId}`, requestData)
      } else {
        await request.post('/questions', requestData)
      }

      await loadQuestions()
      handleCancelAdd()
    } catch (err: any) {
      alert(err.message || '创建失败')
    }
  }

  // 保存新增 - 回答问题
  const handleSaveAnswering = async () => {
    if (!answeringForm.title || !answeringForm.text) {
      alert('请填写题目标题和短文文本内容')
      return
    }

    // 验证所有问题都已填写
    const hasEmpty = answeringForm.questions.some((q) => !q)
    if (hasEmpty) {
      alert('请填写所有问题')
      return
    }

    try {
      const contentJson = {
        text: {
          content: answeringForm.text,
          audio_url: answeringForm.textAudioUrl || '',
        },
        questions: (answeringForm.questionsAudioUrl ?? answeringForm.questions.map(() => '')).map((url, i) => ({
          content: answeringForm.questions[i],
          audio_url: url || '',
        })),
      }

      const requestData: any = {
        title: answeringForm.title,
        type: 'answering',
        difficulty: answeringForm.difficulty,
        content_json: contentJson,
      }
      
      // 在编辑模式下总是传递 mode，以便正确更新 usage_type
      // 在新增模式下，如果 mode 是 'unset' 则不传递（使用默认值）
      if (isEditing || answeringForm.mode !== 'unset') {
        requestData.mode = answeringForm.mode
      }

      if (isEditing && editingQuestionId) {
        await request.put(`/questions/${editingQuestionId}`, requestData)
      } else {
        await request.post('/questions', requestData)
      }

      await loadQuestions()
      handleCancelAdd()
    } catch (err: any) {
      alert(err.message || '创建失败')
    }
  }

  // 保存新增 - 短文复述及提问
  const handleSaveRetelling = async () => {
    if (!retellingForm.title || !retellingForm.theme || !retellingForm.example) {
      alert('请填写题目标题、主题和示例文本')
      return
    }

    // 验证所有问题都已填写
    const hasEmpty = retellingForm.questions.some((q) => !q)
    if (hasEmpty) {
      alert('请填写所有问题')
      return
    }

    try {
      const contentJson = {
        text: {
          theme: retellingForm.theme,
          example: retellingForm.example,
          img_url: retellingForm.img_url || '', // 图片URL可选
        },
        questions: (retellingForm.questionsAudioUrl ?? retellingForm.questions.map(() => '')).map((url, i) => ({
          content: retellingForm.questions[i],
          audio_url: url || '',
        })),
      }

      const requestData: any = {
        title: retellingForm.title,
        type: 'retelling',
        difficulty: retellingForm.difficulty,
        content_json: contentJson,
      }
      
      // 在编辑模式下总是传递 mode，以便正确更新 usage_type
      // 在新增模式下，如果 mode 是 'unset' 则不传递（使用默认值）
      if (isEditing || retellingForm.mode !== 'unset') {
        requestData.mode = retellingForm.mode
      }

      if (isEditing && editingQuestionId) {
        await request.put(`/questions/${editingQuestionId}`, requestData)
      } else {
        await request.post('/questions', requestData)
      }

      await loadQuestions()
      handleCancelAdd()
    } catch (err: any) {
      alert(err.message || '创建失败')
    }
  }

  // 开始新增试卷
  const handleStartAddPaper = () => {
    setIsAddingPaper(true)
    setExamPaperForm({
      name: '',
      description: '',
      time_limit: 1200,
      total_score: 100,
      questions: {
        imitation: { questionId: null, score: 25 },
        listening: { questionId: null, score: 25 },
        answering: { questionId: null, score: 25 },
        retelling: { questionId: null, score: 25 },
      },
    })
    loadAvailableQuestions()
  }

  // 取消新增试卷
  const handleCancelAddPaper = () => {
    setIsAddingPaper(false)
  }

  // 保存新增试卷
  const handleSavePaper = async () => {
    if (!examPaperForm.name) {
      alert('请填写试卷名称')
      return
    }

    // 验证所有题型都已选择题目
    const { questions } = examPaperForm
    if (!questions.imitation.questionId || !questions.listening.questionId || 
        !questions.answering.questionId || !questions.retelling.questionId) {
      alert('请为所有题型选择题目')
      return
    }

    // 验证总分是否等于各题分值之和
    const totalScore = questions.imitation.score + questions.listening.score + 
                      questions.answering.score + questions.retelling.score
    if (Math.abs(totalScore - examPaperForm.total_score) > 0.01) {
      alert(`各题分值之和（${totalScore}）与试卷总分（${examPaperForm.total_score}）不一致`)
      return
    }

    try {
      // 创建试卷
      const paperResponse = (await request.post('/exam-papers', {
        name: examPaperForm.name,
        description: examPaperForm.description || '',
        time_limit: examPaperForm.time_limit,
        total_score: examPaperForm.total_score,
        section_config: {
          section1: { count: 1, score: questions.imitation.score },
          section2: { count: 1, score: questions.listening.score },
          section3: { count: 1, score: questions.answering.score },
          section4: { count: 1, score: questions.retelling.score },
        },
      })) as { code: number; message: string; data: { id: number } }

      if (paperResponse.code === 200 && paperResponse.data) {
        const paperId = paperResponse.data.id

        // 创建试卷题目关联关系
        const paperQuestions = [
          {
            paper_id: paperId,
            question_id: questions.imitation.questionId,
            question_type: 1, // 模仿朗读
            section: 1,
            order_num: 1,
            max_score: questions.imitation.score,
          },
          {
            paper_id: paperId,
            question_id: questions.listening.questionId,
            question_type: 2, // 听选信息
            section: 2,
            order_num: 1,
            max_score: questions.listening.score,
          },
          {
            paper_id: paperId,
            question_id: questions.answering.questionId,
            question_type: 3, // 回答问题
            section: 3,
            order_num: 1,
            max_score: questions.answering.score,
          },
          {
            paper_id: paperId,
            question_id: questions.retelling.questionId,
            question_type: 4, // 短文复述及提问
            section: 4,
            order_num: 1,
            max_score: questions.retelling.score,
          },
        ]

        // 批量创建试卷题目关联
        for (const pq of paperQuestions) {
          await request.post('/paper-questions', pq)
        }

        alert('试卷创建成功')
        handleCancelAddPaper()
        // 可以在这里刷新试卷列表
      }
    } catch (err: any) {
      alert(err.message || '创建失败')
    }
  }

  return (
    <div>
      {/* 标签页切换 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, borderBottom: '2px solid #e5e7eb' }}>
          <button
            type="button"
            onClick={() => setActiveTab('questions')}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              backgroundColor: 'transparent',
              color: activeTab === 'questions' ? '#3b82f6' : '#6b7280',
              fontSize: 14,
              fontWeight: activeTab === 'questions' ? 600 : 400,
              cursor: 'pointer',
              borderBottom: activeTab === 'questions' ? '2px solid #3b82f6' : '2px solid transparent',
              marginBottom: '-2px',
            }}
          >
            专项练习
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('papers')}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              backgroundColor: 'transparent',
              color: activeTab === 'papers' ? '#3b82f6' : '#6b7280',
              fontSize: 14,
              fontWeight: activeTab === 'papers' ? 600 : 400,
              cursor: 'pointer',
              borderBottom: activeTab === 'papers' ? '2px solid #3b82f6' : '2px solid transparent',
              marginBottom: '-2px',
            }}
          >
            考试
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preface')}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              backgroundColor: 'transparent',
              color: activeTab === 'preface' ? '#3b82f6' : '#6b7280',
              fontSize: 14,
              fontWeight: activeTab === 'preface' ? 600 : 400,
              cursor: 'pointer',
              borderBottom: activeTab === 'preface' ? '2px solid #3b82f6' : '2px solid transparent',
              marginBottom: '-2px',
            }}
          >
            旁白语音
          </button>
        </div>
      </div>

      {activeTab === 'questions' ? (
        <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>专项练习</h2>
          <p style={{ color: '#6b7280', fontSize: 13 }}>
                管理练习题目，支持按题型进行筛选，难度范围为 1-5 星级。
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => handleStartAdd('imitation')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 8,
              border: 'none',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              fontSize: 13,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            + 新增模仿朗读
          </button>
          <button
            type="button"
            onClick={() => handleStartAdd('listening')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 8,
              border: 'none',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              fontSize: 13,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            + 新增听选信息
          </button>
          <button
            type="button"
            onClick={() => handleStartAdd('answering')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 8,
              border: 'none',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              fontSize: 13,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            + 新增回答问题
          </button>
          <button
            type="button"
            onClick={() => handleStartAdd('retelling')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 8,
              border: 'none',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              fontSize: 13,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            + 新增短文复述及提问
          </button>
        </div>
      </div>

      {/* 查看题目弹窗 */}
      {isViewing && viewingQuestion && (
        <section
          style={{
            borderRadius: 12,
            border: '1px solid #3b82f6',
            backgroundColor: '#f0f9ff',
            padding: '1.5rem',
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>查看题目详情</h3>
            <button
              type="button"
              onClick={() => {
                if (currentAudioRef.current) {
                  currentAudioRef.current.pause()
                  currentAudioRef.current = null
                }
                setIsViewing(false)
                setViewingQuestion(null)
                setPlayingAudioUrl(null)
                setAudioError(null)
              }}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: 6,
                border: '1px solid #e5e7eb',
                backgroundColor: '#ffffff',
                color: '#4b5563',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              关闭
            </button>
          </div>
          {audioError && (
            <div style={{ marginBottom: 12, padding: '0.5rem 0.75rem', borderRadius: 6, backgroundColor: '#fee2e2', color: '#991b1b', fontSize: 13 }}>
              {audioError}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                  题目编号
                </label>
                <div style={{ padding: '0.5rem 0.75rem', borderRadius: 8, backgroundColor: '#ffffff', fontSize: 13 }}>
                  {viewingQuestion.id}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                  题目标题
                </label>
                <div style={{ padding: '0.5rem 0.75rem', borderRadius: 8, backgroundColor: '#ffffff', fontSize: 13 }}>
                  {viewingQuestion.title}
                </div>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                  题型
                </label>
                <div style={{ padding: '0.5rem 0.75rem', borderRadius: 8, backgroundColor: '#ffffff', fontSize: 13 }}>
                  {QUESTION_TYPES.find((t) => t.value === viewingQuestion.type)?.label || viewingQuestion.type}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                  难度
                </label>
                <div style={{ padding: '0.5rem 0.75rem', borderRadius: 8, backgroundColor: '#ffffff', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {renderDifficultyStars(viewingQuestion.difficulty)}
                  <span style={{ fontSize: 12, color: '#6b7280' }}>({viewingQuestion.difficulty}星)</span>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                  模式
                </label>
                <div style={{ padding: '0.5rem 0.75rem', borderRadius: 8, backgroundColor: '#ffffff', fontSize: 13 }}>
                  {getUsageTypeLabel(viewingQuestion.usage_type)}
                </div>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                  是否启用
                </label>
                <div style={{ padding: '0.5rem 0.75rem', borderRadius: 8, backgroundColor: '#ffffff', fontSize: 13 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '0.2rem 0.6rem',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 500,
                      backgroundColor: viewingQuestion.is_active ? '#d1fae5' : '#fee2e2',
                      color: viewingQuestion.is_active ? '#065f46' : '#991b1b',
                    }}
                  >
                    {viewingQuestion.is_active ? '启用' : '禁用'}
                  </span>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                  所属类别
                </label>
                <div style={{ padding: '0.5rem 0.75rem', borderRadius: 8, backgroundColor: '#ffffff', fontSize: 13 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '0.2rem 0.6rem',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 500,
                      backgroundColor: getUsageTypeColor(viewingQuestion.usage_type).bg,
                      color: getUsageTypeColor(viewingQuestion.usage_type).text,
                    }}
                  >
                    {getUsageTypeLabel(viewingQuestion.usage_type)}
                  </span>
                </div>
              </div>
            </div>
            
            {/* 题目内容详情 - 根据题型显示不同内容 */}
            {(() => {
              const questionDetail = viewingQuestion as any
              const contentJson = questionDetail.content_json
              
              if (viewingQuestion.type === 'imitation' && contentJson) {
                return (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
                      <label style={{ fontSize: 12, color: '#6b7280' }}>
                        题目内容
                      </label>
                      {renderPlayButton(contentJson.audio_url, '播放朗读语音')}
                    </div>
                    <div style={{ padding: '1rem', borderRadius: 8, backgroundColor: '#ffffff', fontSize: 13, whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>
                      {contentJson.content || ''}
                    </div>
                  </div>
                )
              } else if (viewingQuestion.type === 'listening' && Array.isArray(contentJson)) {
                return (
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                      对话和问题内容
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {contentJson.map((dialogue: any, idx: number) => (
                        <div key={idx} style={{ padding: '1rem', borderRadius: 8, backgroundColor: '#ffffff' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#4b5563' }}>
                            对话 {idx + 1}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                            <div style={{ fontSize: 13, color: '#1f2937', whiteSpace: 'pre-wrap', flex: 1, minWidth: 0 }}>
                              {dialogue.text?.content || ''}
                            </div>
                            {renderPlayButton(dialogue.text?.audio_url, `播放对话 ${idx + 1} 语音`)}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {dialogue.questions?.map((q: any, qIdx: number) => (
                              <div key={qIdx} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '0.75rem', borderRadius: 6, backgroundColor: '#f9fafb', fontSize: 12 }}>
                                <span style={{ fontWeight: 600, color: '#6b7280' }}>问题 {qIdx + 1}:</span>
                                <span style={{ flex: 1, minWidth: 0 }}>{q.content || ''}</span>
                                {renderPlayButton(q.audio_url, `播放问题 ${qIdx + 1} 语音`)}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              } else if (viewingQuestion.type === 'answering' && contentJson) {
                return (
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                      短文和问题内容
                    </label>
                    <div style={{ padding: '1rem', borderRadius: 8, backgroundColor: '#ffffff', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#4b5563' }}>短文</div>
                        {renderPlayButton(contentJson.text?.audio_url, '播放短文语音')}
                      </div>
                      <div style={{ fontSize: 13, color: '#1f2937', whiteSpace: 'pre-wrap' }}>
                        {contentJson.text?.content || ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {contentJson.questions?.map((q: any, idx: number) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '0.75rem', borderRadius: 6, backgroundColor: '#ffffff', fontSize: 12 }}>
                          <span style={{ fontWeight: 600, color: '#6b7280' }}>问题 {idx + 1}:</span>
                          <span style={{ flex: 1, minWidth: 0 }}>{q.content || ''}</span>
                          {renderPlayButton(q.audio_url, `播放问题 ${idx + 1} 语音`)}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              } else if (viewingQuestion.type === 'retelling' && contentJson) {
                return (
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                      主题、示例和问题内容
                    </label>
                    <div style={{ padding: '1rem', borderRadius: 8, backgroundColor: '#ffffff', marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#4b5563' }}>主题</div>
                      <div style={{ fontSize: 13, color: '#1f2937', marginBottom: 12 }}>
                        {contentJson.text?.theme || ''}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#4b5563' }}>示例</div>
                      <div style={{ fontSize: 13, color: '#1f2937', whiteSpace: 'pre-wrap' }}>
                        {contentJson.text?.example || ''}
                      </div>
                      {contentJson.text?.img_url && (
                        <>
                          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 12, marginBottom: 8, color: '#4b5563' }}>图片URL</div>
                          <div style={{ fontSize: 13, color: '#3b82f6', wordBreak: 'break-all' }}>
                            {contentJson.text.img_url}
                          </div>
                        </>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {contentJson.questions?.map((q: any, idx: number) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '0.75rem', borderRadius: 6, backgroundColor: '#ffffff', fontSize: 12 }}>
                          <span style={{ fontWeight: 600, color: '#6b7280' }}>问题 {idx + 1}:</span>
                          <span style={{ flex: 1, minWidth: 0 }}>{q.content || ''}</span>
                          {renderPlayButton(q.audio_url, `播放问题 ${idx + 1} 语音`)}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              }
              return null
            })()}
          </div>
        </section>
      )}

      {/* 新增/编辑题目表单 */}
      {(isAdding || isEditing) && (
        <section
          style={{
            borderRadius: 12,
            border: '1px solid #3b82f6',
            backgroundColor: '#eff6ff',
            padding: '1.5rem',
            marginBottom: 20,
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
            {isEditing ? '编辑' : '新增'}{newQuestionType === 'imitation' ? '模仿朗读' : newQuestionType === 'listening' ? '听选信息' : newQuestionType === 'answering' ? '回答问题' : '短文复述及提问'}题目
          </h3>
          {audioError && (
            <div style={{ marginBottom: 12, padding: '0.5rem 0.75rem', borderRadius: 6, backgroundColor: '#fee2e2', color: '#991b1b', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span>{audioError}</span>
              <button type="button" onClick={() => setAudioError(null)} style={{ flexShrink: 0, padding: '0.2rem 0.5rem', fontSize: 12, border: '1px solid #991b1b', borderRadius: 4, background: 'transparent', color: '#991b1b', cursor: 'pointer' }}>关闭</button>
            </div>
          )}

          {newQuestionType === 'imitation' ? (
            // 模仿朗读表单
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                    题目标题 *
                  </label>
                  <input
                    type="text"
                    value={imitationForm.title}
                    onChange={(e) => setImitationForm({ ...imitationForm, title: e.target.value })}
                    placeholder="请输入题目标题"
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      fontSize: 13,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                    模式
                  </label>
                  <select
                    value={imitationForm.mode}
                    onChange={(e) =>
                      setImitationForm({ ...imitationForm, mode: e.target.value as 'practice' | 'exam' | 'unset' })
                    }
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    <option value="unset">未指定</option>
                    <option value="practice">专项练习</option>
                    <option value="exam">试卷</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                    难度 (1-5) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    step="1"
                    value={imitationForm.difficulty}
                    onChange={(e) =>
                      setImitationForm({ ...imitationForm, difficulty: parseInt(e.target.value) || 3 })
                    }
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      fontSize: 13,
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    当前难度：{getDifficultyLabel(imitationForm.difficulty)} ({imitationForm.difficulty}星)
                  </div>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                  朗读内容 *
                </label>
                <textarea
                  value={imitationForm.content}
                  onChange={(e) => setImitationForm({ ...imitationForm, content: e.target.value })}
                  placeholder="请输入需要模仿朗读的文本内容"
                  rows={6}
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
                {renderEditAudioActions(imitationForm.audio_url, {
                  text: imitationForm.content,
                  index: 0,
                  actionKey: 'imitation',
                })}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleSaveImitation}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: 8,
                    border: 'none',
                    backgroundColor: '#3b82f6',
                    color: '#ffffff',
                    fontSize: 13,
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={handleCancelAdd}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    backgroundColor: '#ffffff',
                    color: '#4b5563',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  取消
                </button>
              </div>
            </div>
          ) : newQuestionType === 'listening' ? (
            // 听选信息表单
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                    题目标题 *
                  </label>
                  <input
                    type="text"
                    value={listeningForm.title}
                    onChange={(e) => setListeningForm({ ...listeningForm, title: e.target.value })}
                    placeholder="请输入题目标题"
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      fontSize: 13,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                    模式
                  </label>
                  <select
                    value={listeningForm.mode}
                    onChange={(e) =>
                      setListeningForm({ ...listeningForm, mode: e.target.value as 'practice' | 'exam' | 'unset' })
                    }
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    <option value="unset">未指定</option>
                    <option value="practice">专项练习</option>
                    <option value="exam">试卷</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                    难度 (1-5) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    step="1"
                    value={listeningForm.difficulty}
                    onChange={(e) =>
                      setListeningForm({ ...listeningForm, difficulty: parseInt(e.target.value) || 3 })
                    }
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      fontSize: 13,
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    当前难度：{getDifficultyLabel(listeningForm.difficulty)} ({listeningForm.difficulty}星)
                  </div>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
                  对话内容（共3段对话，每段包含对话文本和2个问题）*
                </label>
                {listeningForm.dialogues.map((dialogue, index) => (
                  <div
                    key={index}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      padding: '1rem',
                      marginBottom: 16,
                      backgroundColor: '#ffffff',
                    }}
                  >
                    <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                      第 {index + 1} 段对话
                    </h4>
                    <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                        对话文本 *
                </label>
                <textarea
                        value={dialogue.text}
                        onChange={(e) => {
                          const newDialogues = [...listeningForm.dialogues]
                          newDialogues[index].text = e.target.value
                          setListeningForm({ ...listeningForm, dialogues: newDialogues })
                        }}
                        placeholder="请输入对话文本内容"
                        rows={3}
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
                {renderEditAudioActions(dialogue.textAudioUrl, {
                  text: dialogue.text,
                  index: index * 3,
                  actionKey: `listening_${index}_text`,
                })}
              </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                        <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                          问题 1 *
                </label>
                        <input
                          type="text"
                          value={dialogue.questions[0]}
                          onChange={(e) => {
                            const newDialogues = [...listeningForm.dialogues]
                            newDialogues[index].questions[0] = e.target.value
                            setListeningForm({ ...listeningForm, dialogues: newDialogues })
                          }}
                          placeholder="请输入第一个问题"
                          style={{
                            width: '100%',
                            padding: '0.5rem 0.75rem',
                            borderRadius: 8,
                            border: '1px solid #e5e7eb',
                            fontSize: 13,
                          }}
                        />
                {renderEditAudioActions(dialogue.questionsAudioUrl?.[0], {
                  text: dialogue.questions[0],
                  index: index * 3 + 1,
                  actionKey: `listening_${index}_q0`,
                })}
                      </div>
                      <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                          问题 2 *
                    </label>
                    <input
                      type="text"
                          value={dialogue.questions[1]}
                      onChange={(e) => {
                            const newDialogues = [...listeningForm.dialogues]
                            newDialogues[index].questions[1] = e.target.value
                            setListeningForm({ ...listeningForm, dialogues: newDialogues })
                      }}
                          placeholder="请输入第二个问题"
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 8,
                        border: '1px solid #e5e7eb',
                        fontSize: 13,
                      }}
                    />
                {renderEditAudioActions(dialogue.questionsAudioUrl?.[1], {
                  text: dialogue.questions[1],
                  index: index * 3 + 2,
                  actionKey: `listening_${index}_q1`,
                })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleSaveListening}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: 8,
                    border: 'none',
                    backgroundColor: '#3b82f6',
                    color: '#ffffff',
                    fontSize: 13,
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={handleCancelAdd}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    backgroundColor: '#ffffff',
                    color: '#4b5563',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  取消
                </button>
              </div>
            </div>
          ) : newQuestionType === 'answering' ? (
            // 回答问题表单
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                    题目标题 *
                  </label>
                  <input
                    type="text"
                    value={answeringForm.title}
                    onChange={(e) => setAnsweringForm({ ...answeringForm, title: e.target.value })}
                    placeholder="请输入题目标题"
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      fontSize: 13,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                    模式
                  </label>
                  <select
                    value={answeringForm.mode}
                    onChange={(e) =>
                      setAnsweringForm({ ...answeringForm, mode: e.target.value as 'practice' | 'exam' | 'unset' })
                    }
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    <option value="unset">未指定</option>
                    <option value="practice">专项练习</option>
                    <option value="exam">试卷</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                    难度 (1-5) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    step="1"
                    value={answeringForm.difficulty}
                    onChange={(e) =>
                      setAnsweringForm({ ...answeringForm, difficulty: parseInt(e.target.value) || 3 })
                    }
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      fontSize: 13,
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    当前难度：{getDifficultyLabel(answeringForm.difficulty)} ({answeringForm.difficulty}星)
                  </div>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                  短文文本内容 *
                </label>
                <textarea
                  value={answeringForm.text}
                  onChange={(e) => setAnsweringForm({ ...answeringForm, text: e.target.value })}
                  placeholder="请输入短文文本内容或提示信息"
                  rows={6}
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
                {renderEditAudioActions(answeringForm.textAudioUrl, {
                  text: answeringForm.text,
                  index: 0,
                  actionKey: 'answering_text',
                })}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
                  问题内容（共4个问题）*
                </label>
                {answeringForm.questions.map((question, index) => (
                  <div key={index} style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                      问题 {index + 1} *
                    </label>
                    <input
                      type="text"
                      value={question}
                      onChange={(e) => {
                        const newQuestions = [...answeringForm.questions] as [string, string, string, string]
                        newQuestions[index] = e.target.value
                        setAnsweringForm({ ...answeringForm, questions: newQuestions })
                      }}
                      placeholder={`请输入第${index + 1}个问题的内容`}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 8,
                        border: '1px solid #e5e7eb',
                        fontSize: 13,
                      }}
                    />
                    {renderEditAudioActions(answeringForm.questionsAudioUrl?.[index], {
                      text: question,
                      index: index + 1,
                      actionKey: `answering_q${index}`,
                    })}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleSaveAnswering}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: 8,
                    border: 'none',
                    backgroundColor: '#3b82f6',
                    color: '#ffffff',
                    fontSize: 13,
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={handleCancelAdd}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    backgroundColor: '#ffffff',
                    color: '#4b5563',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            // 短文复述及提问表单
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                    题目标题 *
                  </label>
                  <input
                    type="text"
                    value={retellingForm.title}
                    onChange={(e) => setRetellingForm({ ...retellingForm, title: e.target.value })}
                    placeholder="请输入题目标题"
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      fontSize: 13,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                    模式
                  </label>
                  <select
                    value={retellingForm.mode}
                    onChange={(e) =>
                      setRetellingForm({ ...retellingForm, mode: e.target.value as 'practice' | 'exam' | 'unset' })
                    }
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    <option value="unset">未指定</option>
                    <option value="practice">专项练习</option>
                    <option value="exam">试卷</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                    难度 (1-5) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    step="1"
                    value={retellingForm.difficulty}
                    onChange={(e) =>
                      setRetellingForm({ ...retellingForm, difficulty: parseInt(e.target.value) || 3 })
                    }
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      fontSize: 13,
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    当前难度：{getDifficultyLabel(retellingForm.difficulty)} ({retellingForm.difficulty}星)
                  </div>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                  主题描述（中文）*
                </label>
                <input
                  type="text"
                  value={retellingForm.theme}
                  onChange={(e) => setRetellingForm({ ...retellingForm, theme: e.target.value })}
                  placeholder="请输入主题描述，例如：Mike介绍他和朋友们去散步的计划"
                    style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                      borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    fontSize: 13,
                  }}
                />
              </div>
              <div>
                      <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                  示例文本内容（英文短文）*
                      </label>
                      <textarea
                  value={retellingForm.example}
                  onChange={(e) => setRetellingForm({ ...retellingForm, example: e.target.value })}
                  placeholder="请输入示例文本内容（英文短文）"
                  rows={6}
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
                    </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                  图片URL（可选）
                        </label>
                        <input
                          type="text"
                  value={retellingForm.img_url}
                  onChange={(e) => setRetellingForm({ ...retellingForm, img_url: e.target.value })}
                  placeholder="请输入图片URL，例如：https://example.com/images/park_scene.jpg"
                          style={{
                            width: '100%',
                            padding: '0.5rem 0.75rem',
                            borderRadius: 8,
                            border: '1px solid #e5e7eb',
                            fontSize: 13,
                          }}
                        />
                      </div>
                      <div>
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
                  问题内容（共2个问题，中文）*
                </label>
                {retellingForm.questions.map((question, index) => (
                  <div key={index} style={{ marginBottom: 12 }}>
                        <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                      问题 {index + 1} *
                        </label>
                        <input
                          type="text"
                      value={question}
                          onChange={(e) => {
                        const newQuestions = [...retellingForm.questions] as [string, string]
                        newQuestions[index] = e.target.value
                        setRetellingForm({ ...retellingForm, questions: newQuestions })
                          }}
                      placeholder={`请输入第${index + 1}个问题的内容（中文），例如：你想知道他们经常去公园散步吗，你问Mike：`}
                          style={{
                            width: '100%',
                            padding: '0.5rem 0.75rem',
                            borderRadius: 8,
                            border: '1px solid #e5e7eb',
                            fontSize: 13,
                          }}
                        />
                    {renderEditAudioActions(retellingForm.questionsAudioUrl?.[index], {
                      text: question,
                      index,
                      actionKey: `retelling_q${index}`,
                    })}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleSaveRetelling}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: 8,
                    border: 'none',
                    backgroundColor: '#3b82f6',
                    color: '#ffffff',
                    fontSize: 13,
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={handleCancelAdd}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    backgroundColor: '#ffffff',
                    color: '#4b5563',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </section>
      )}

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

            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                是否启用
              </label>
              <select
                value={isActive}
                onChange={(e) => {
                  setIsActive(e.target.value as 'all' | 'true' | 'false')
                  setCurrentPage(1)
                }}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  backgroundColor: '#ffffff',
                  fontSize: 13,
                  cursor: 'pointer',
                  minWidth: 120,
                }}
              >
                <option value="all">全部</option>
                <option value="true">启用</option>
                <option value="false">禁用</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                所属类别
              </label>
              <select
                value={usageType}
                onChange={(e) => {
                  setUsageType(e.target.value as 'all' | '0' | '1' | '2')
                  setCurrentPage(1)
                }}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  backgroundColor: '#ffffff',
                  fontSize: 13,
                  cursor: 'pointer',
                  minWidth: 120,
                }}
              >
                <option value="all">全部</option>
                <option value="1">专项练习</option>
                <option value="2">试卷</option>
                <option value="0">未指定</option>
              </select>
            </div>

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
                <th style={{ textAlign: 'left', padding: '0.6rem 0.9rem', fontWeight: 600 }}>题型</th>
                <th style={{ textAlign: 'left', padding: '0.6rem 0.9rem', fontWeight: 600 }}>题目名称</th>
                <th style={{ textAlign: 'center', padding: '0.6rem 0.9rem', fontWeight: 600 }}>难度</th>
                <th style={{ textAlign: 'center', padding: '0.6rem 0.9rem', fontWeight: 600 }}>是否启用</th>
                <th style={{ textAlign: 'left', padding: '0.6rem 0.9rem', fontWeight: 600 }}>所属类别</th>
                <th style={{ textAlign: 'center', padding: '0.6rem 0.9rem', fontWeight: 600 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
                    加载中...
                  </td>
                </tr>
              ) : paginatedQuestions.length > 0 ? (
                paginatedQuestions.map((question) => (
                  <tr key={question.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.6rem 0.9rem' }}>{question.id}</td>
                    <td style={{ padding: '0.6rem 0.9rem' }}>
                      {question.type === 'exam' ? (
                        <span style={{ color: '#6b7280' }}>综合测试</span>
                      ) : (
                        QUESTION_TYPES.find((t) => t.value === question.type)?.label || question.type
                      )}
                    </td>
                    <td style={{ padding: '0.6rem 0.9rem' }}>{question.title}</td>
                    <td style={{ padding: '0.6rem 0.9rem', textAlign: 'center' }}>
                      {renderDifficultyStars(question.difficulty)}
                    </td>
                    <td style={{ padding: '0.6rem 0.9rem', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.6rem',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 500,
                          backgroundColor: question.is_active ? '#d1fae5' : '#fee2e2',
                          color: question.is_active ? '#065f46' : '#991b1b',
                        }}
                      >
                        {question.is_active ? '启用' : '禁用'}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem 0.9rem' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.6rem',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 500,
                          backgroundColor: getUsageTypeColor(question.usage_type).bg,
                          color: getUsageTypeColor(question.usage_type).text,
                        }}
                      >
                        {getUsageTypeLabel(question.usage_type)}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem 0.9rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleViewQuestion(question)}
                          style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: 4,
                            border: '1px solid #3b82f6',
                            backgroundColor: '#ffffff',
                            color: '#3b82f6',
                            fontSize: 12,
                            cursor: 'pointer',
                            fontWeight: 500,
                          }}
                        >
                          查看
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditQuestion(question)}
                          style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: 4,
                            border: '1px solid #10b981',
                            backgroundColor: '#ffffff',
                            color: '#10b981',
                            fontSize: 12,
                            cursor: 'pointer',
                            fontWeight: 500,
                          }}
                        >
                          编辑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
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
        </>
      ) : activeTab === 'papers' ? (
        <>
          {/* 考试 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <h2 style={{ fontSize: 20, marginBottom: 8 }}>考试</h2>
              <p style={{ color: '#6b7280', fontSize: 13 }}>
                创建和管理试卷，试卷包含4种题型各一道题目。只能选择"未指定"类别的题目。
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={handleStartAddPaper}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                + 新增试卷
              </button>
            </div>
          </div>

          {/* 新增试卷表单 */}
          {isAddingPaper && (
            <section
              style={{
                borderRadius: 12,
                border: '1px solid #3b82f6',
                backgroundColor: '#eff6ff',
                padding: '1.5rem',
                marginBottom: 20,
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>新增试卷</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* 试卷基本信息 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                      试卷名称 *
                    </label>
                    <input
                      type="text"
                      value={examPaperForm.name}
                      onChange={(e) => setExamPaperForm({ ...examPaperForm, name: e.target.value })}
                      placeholder="请输入试卷名称"
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 8,
                        border: '1px solid #e5e7eb',
                        fontSize: 13,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                      时间限制（秒）*
                    </label>
                    <input
                      type="number"
                      min="60"
                      step="60"
                      value={examPaperForm.time_limit}
                      onChange={(e) =>
                        setExamPaperForm({ ...examPaperForm, time_limit: parseInt(e.target.value) || 1200 })
                      }
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 8,
                        border: '1px solid #e5e7eb',
                        fontSize: 13,
                      }}
                    />
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                      默认1200秒（20分钟）
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                      试卷总分 *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={examPaperForm.total_score}
                      onChange={(e) =>
                        setExamPaperForm({ ...examPaperForm, total_score: parseInt(e.target.value) || 100 })
                      }
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 8,
                        border: '1px solid #e5e7eb',
                        fontSize: 13,
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      当前各题分值之和：{' '}
                      {examPaperForm.questions.imitation.score +
                        examPaperForm.questions.listening.score +
                        examPaperForm.questions.answering.score +
                        examPaperForm.questions.retelling.score}
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                    试卷描述（可选）
                  </label>
                  <textarea
                    value={examPaperForm.description}
                    onChange={(e) => setExamPaperForm({ ...examPaperForm, description: e.target.value })}
                    placeholder="请输入试卷描述"
                    rows={3}
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
                </div>

                {/* 选择题目 */}
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>选择题目（每种题型各选一道）</h4>
                  
                  {QUESTION_TYPES.map((type) => {
                    const typeKey = type.value as 'imitation' | 'listening' | 'answering' | 'retelling'
                    const questions = availableQuestions[typeKey]
                    const selectedQuestion = examPaperForm.questions[typeKey]

                    return (
                      <div
                        key={type.value}
                        style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: 8,
                          padding: '1rem',
                          marginBottom: 16,
                          backgroundColor: '#ffffff',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                            {type.label} *
                          </label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <label style={{ fontSize: 12, color: '#6b7280' }}>分值：</label>
                            <input
                              type="number"
                              min="1"
                              value={selectedQuestion.score}
                              onChange={(e) => {
                                const newQuestions = { ...examPaperForm.questions }
                                newQuestions[typeKey].score = parseInt(e.target.value) || 25
                                setExamPaperForm({ ...examPaperForm, questions: newQuestions })
                              }}
                              style={{
                                width: 80,
                                padding: '0.25rem 0.5rem',
                                borderRadius: 6,
                                border: '1px solid #e5e7eb',
                                fontSize: 12,
                              }}
                            />
                          </div>
                        </div>
                        <select
                          value={selectedQuestion.questionId || ''}
                          onChange={(e) => {
                            const newQuestions = { ...examPaperForm.questions }
                            newQuestions[typeKey].questionId = e.target.value ? parseInt(e.target.value) : null
                            setExamPaperForm({ ...examPaperForm, questions: newQuestions })
                          }}
                          style={{
                            width: '100%',
                            padding: '0.5rem 0.75rem',
                            borderRadius: 8,
                            border: '1px solid #e5e7eb',
                            fontSize: 13,
                            cursor: 'pointer',
                          }}
                        >
                          <option value="">请选择题目</option>
                          {questions.map((q) => (
                            <option key={q.id} value={q.id}>
                              {q.title} (难度: {q.difficulty.toFixed(2)})
                            </option>
                          ))}
                        </select>
                        {questions.length === 0 && (
                          <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>
                            暂无可用题目，请先在专项练习中创建{type.label}题目（类别需为"未指定"）
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleSavePaper}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: 8,
                      border: 'none',
                      backgroundColor: '#3b82f6',
                      color: '#ffffff',
                      fontSize: 13,
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelAddPaper}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      backgroundColor: '#ffffff',
                      color: '#4b5563',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    取消
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* 试卷列表（暂时为空，可以后续添加） */}
          <section
            style={{
              borderRadius: 12,
              border: '1px solid #e5e7eb',
              backgroundColor: '#ffffff',
              padding: '1.5rem',
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>试卷列表</h3>
            <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
              试卷列表功能待开发
            </div>
          </section>
        </>
      ) : (
        <>
          {/* 旁白语音 */}
          <div style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>旁白语音</h2>
            <p style={{ color: '#6b7280', fontSize: 13 }}>
              各题型前置旁白文本的语音合成，同一题型下所有题目共用。生成后即保存到题型配置中。音色由配置中的「旁白音色」控制。
            </p>
          </div>
          {prefaceLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>加载中…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {prefaceList.map((qt) => (
                <section
                  key={qt.id}
                  style={{
                    borderRadius: 12,
                    border: '1px solid #e5e7eb',
                    backgroundColor: '#ffffff',
                    padding: '1.5rem',
                  }}
                >
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{qt.type_name}</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {qt.items.map((item) => {
                      const genKey = `${qt.id}-${item.index}`
                      const isGenerating = prefaceGeneratingKey === genKey
                      const canPlay = !!item.audio_url
                      return (
                        <div
                          key={item.index}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 12,
                            padding: '0.75rem',
                            borderRadius: 8,
                            backgroundColor: '#f9fafb',
                            border: '1px solid #e5e7eb',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 13,
                                color: '#374151',
                                lineHeight: 1.5,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical' as const,
                              }}
                              title={item.content}
                            >
                              {item.content || '（无内容）'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                            <button
                              type="button"
                              disabled={isGenerating}
                              onClick={() => handlePrefaceGenerate(qt.id, item.index)}
                              style={{
                                padding: '0.4rem 0.75rem',
                                borderRadius: 6,
                                border: 'none',
                                backgroundColor: isGenerating ? '#9ca3af' : '#3b82f6',
                                color: '#ffffff',
                                fontSize: 12,
                                cursor: isGenerating ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {isGenerating ? '生成中…' : '生成'}
                            </button>
                            <button
                              type="button"
                              disabled={!canPlay}
                              onClick={() => handlePrefacePlay(item.audio_url)}
                              style={{
                                padding: '0.4rem 0.75rem',
                                borderRadius: 6,
                                border: '1px solid #d1d5db',
                                backgroundColor: canPlay ? '#ffffff' : '#f3f4f6',
                                color: canPlay ? '#374151' : '#9ca3af',
                                fontSize: 12,
                                cursor: canPlay ? 'pointer' : 'not-allowed',
                              }}
                            >
                              播放
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
