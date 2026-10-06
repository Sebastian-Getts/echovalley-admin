import { useState, useMemo, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import request from "../utils/request";
import { useToast } from "../components/Toast";

// 音频代理URL处理
const getApiBase = () => {
  const base = import.meta.env.VITE_API_BASE_URL || '/api/v1'
  return base.startsWith('http') ? base.replace(/\/$/, '') : `${window.location.origin}${base.startsWith('/') ? base : '/' + base}`
}
const getAudioProxyUrl = (minioUrl: string) =>
  `${getApiBase()}/audio/proxy?url=${encodeURIComponent(minioUrl)}`

// 题型选项
const QUESTION_TYPES = [
  { value: "imitation", label: "模仿朗读" },
  { value: "listening", label: "听选信息" },
  { value: "answering", label: "回答问题" },
  { value: "retelling", label: "短文复述及提问" },
] as const;

// 与后端固定题型配置保持一致，仅用于尚未评分记录的默认满分。
const DEFAULT_MAX_SCORE_BY_TYPE: Record<string, number> = {
  imitation: 10,
  listening: 15,
  answering: 20,
  retelling: 25,
};

// 学生数据类型
interface StudentDetail {
  id: string;
  studentId: string;
  name: string;
  class: string;
  score: number | null;
  maxScore?: number | null;
  grade: "优秀" | "及格" | "低分" | "未评分";
  status?: string;
  audioUrl: string;
  audioUrls?: string[]; // 听选信息有多个音频
  questionTitle?: string; // 题目名称
  questionType?: string; // 题型：imitation, listening, answering, retelling
}

// API返回的答题记录类型
interface StudentAnswerResponse {
  id: number;
  student_id: number;
  question_id: number;
  student_name?: string;
  student_student_id?: string;
  student_class?: string;
  question_title?: string;
  score?: number;
  max_score?: number;
  grade?: string;
  audio_url?: string;
  audio_urls?: string[];  // 所有音频URL（听选信息有多个）
  question_type?: string; // 题型：imitation, listening, answering, retelling
  status: string;
  submitted_at: string;
}

// Mock 学生答题明细数据（根据不同的筛选条件会有不同的数据）
export const generateMockData = (
  _mode: "practice" | "exam",
  _questionType: string,
  selectedQuestion: string
): StudentDetail[] => {
  // 根据筛选条件生成不同的数据
  const baseData: StudentDetail[] = [
    {
      id: "s1",
      studentId: "2024001",
      name: "张三",
      class: "初一(1)班",
      score: 95,
      grade: "优秀",
      audioUrl: "mock-audio-1",
    },
    {
      id: "s2",
      studentId: "2024002",
      name: "李四",
      class: "初一(1)班",
      score: 88,
      grade: "优秀",
      audioUrl: "mock-audio-2",
    },
    {
      id: "s3",
      studentId: "2024003",
      name: "王五",
      class: "初一(1)班",
      score: 76,
      grade: "及格",
      audioUrl: "mock-audio-3",
    },
    {
      id: "s4",
      studentId: "2024004",
      name: "赵六",
      class: "初一(1)班",
      score: 65,
      grade: "及格",
      audioUrl: "mock-audio-4",
    },
    {
      id: "s5",
      studentId: "2024005",
      name: "钱七",
      class: "初一(1)班",
      score: 58,
      grade: "低分",
      audioUrl: "mock-audio-5",
    },
    {
      id: "s6",
      studentId: "2024006",
      name: "孙八",
      class: "初一(2)班",
      score: 92,
      grade: "优秀",
      audioUrl: "mock-audio-6",
    },
    {
      id: "s7",
      studentId: "2024007",
      name: "周九",
      class: "初一(2)班",
      score: 82,
      grade: "优秀",
      audioUrl: "mock-audio-7",
    },
    {
      id: "s8",
      studentId: "2024008",
      name: "吴十",
      class: "初一(2)班",
      score: 70,
      grade: "及格",
      audioUrl: "mock-audio-8",
    },
    {
      id: "s9",
      studentId: "2024009",
      name: "郑一",
      class: "初二(1)班",
      score: 55,
      grade: "低分",
      audioUrl: "mock-audio-9",
    },
    {
      id: "s10",
      studentId: "2024010",
      name: "王二",
      class: "初二(1)班",
      score: 85,
      grade: "优秀",
      audioUrl: "mock-audio-10",
    },
    {
      id: "s11",
      studentId: "2024011",
      name: "刘三",
      class: "初二(1)班",
      score: 78,
      grade: "及格",
      audioUrl: "mock-audio-11",
    },
    {
      id: "s12",
      studentId: "2024012",
      name: "陈四",
      class: "初二(2)班",
      score: 91,
      grade: "优秀",
      audioUrl: "mock-audio-12",
    },
    {
      id: "s13",
      studentId: "2024013",
      name: "杨五",
      class: "初二(2)班",
      score: 68,
      grade: "及格",
      audioUrl: "mock-audio-13",
    },
    {
      id: "s14",
      studentId: "2024014",
      name: "黄六",
      class: "初三(1)班",
      score: 96,
      grade: "优秀",
      audioUrl: "mock-audio-14",
    },
    {
      id: "s15",
      studentId: "2024015",
      name: "林七",
      class: "初三(1)班",
      score: 73,
      grade: "及格",
      audioUrl: "mock-audio-15",
    },
  ];

  // 如果选择了具体题目，返回部分数据（模拟该题目的答题情况）
  if (selectedQuestion !== "all") {
    // 根据题目类型调整分数分布
    const adjustedData = baseData.map((student, index) => {
      let newScore = student.score ?? 0;
      // 模拟不同题目的难度差异
      if (selectedQuestion === "q1") {
        newScore = Math.max(60, (student.score ?? 0) - 5 + (index % 3) * 3);
      } else if (selectedQuestion === "q2") {
        newScore = Math.max(60, (student.score ?? 0) - 3 + (index % 2) * 2);
      } else if (selectedQuestion === "exam1" || selectedQuestion === "exam2") {
        newScore = Math.max(50, (student.score ?? 0) - 8 + (index % 4) * 2);
      }
      const newGrade: "优秀" | "及格" | "低分" =
        newScore >= 90
          ? "优秀"
          : newScore >= 70
          ? "及格"
          : newScore >= 60
          ? "及格"
          : "低分";
      return { ...student, score: newScore, grade: newGrade };
    });
    return adjustedData;
  }

  return baseData;
};

// 语音播放组件（只负责按钮，点击事件由父组件处理）
function AudioPlayer({
  questionType,
  isExpanded,
  onToggleExpand,
  audioUrl,
  isPlaying,
  onPlay,
}: {
  questionType?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  audioUrl?: string;
  isPlaying?: boolean;
  onPlay?: (url: string, index: number) => void;
}) {
  const isExpandable = questionType === 'listening' || questionType === 'answering' || questionType === 'retelling';

  return (
    <div style={{ display: "inline-block" }}>
      {/* 听选信息/回答问题：展开按钮 */}
      {isExpandable && (
        <button
          type="button"
          onClick={onToggleExpand}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            backgroundColor: isExpanded ? "#eff6ff" : "#ffffff",
            color: isExpanded ? "#1d4ed8" : "#6b7280",
            cursor: "pointer",
            fontSize: 14,
          }}
          title={isExpanded ? "收起" : "展开全部"}
        >
          {isExpanded ? "▲" : "▼"}
        </button>
      )}

      {/* 非展开题型：播放按钮 */}
      {!isExpandable && audioUrl && (
        <button
          type="button"
          onClick={() => onPlay?.(audioUrl, 0)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            backgroundColor: isPlaying ? "#eff6ff" : "#ffffff",
            color: isPlaying ? "#1d4ed8" : "#6b7280",
            cursor: "pointer",
            fontSize: 14,
          }}
          title="播放"
        >
          {isPlaying ? "⏸" : "▶"}
        </button>
      )}
    </div>
  );
}

// 展开行组件（均匀排列N个音频按钮）
function ExpandRow({
  audioUrls,
  playingIndex,
  isPlaying,
  onPlay,
  slotCount,
}: {
  audioUrls?: string[];
  playingIndex: number;
  isPlaying: boolean;
  onPlay: (url: string, index: number) => void;
  slotCount: number;
}) {
  return (
    <td colSpan={8} style={{ padding: "0.5rem 0.8rem", backgroundColor: "#f9fafb" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          gap: 8,
        }}
      >
        {Array.from({ length: slotCount }, (_, idx) => {
          const url = audioUrls?.[idx];
          const isCurrentPlaying = playingIndex === idx && isPlaying;
          return (
            <div
              key={idx}
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                minWidth: 70,
              }}
            >
              {/* 题号 */}
              <span
                style={{
                  fontSize: 11,
                  color: "#6b7280",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                }}
              >
                第{idx + 1}题
              </span>
              {/* 播放按钮/空 */}
              {url ? (
                <button
                  type="button"
                  onClick={() => onPlay(url, idx)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                    backgroundColor: isCurrentPlaying ? "#eff6ff" : "#ffffff",
                    color: isCurrentPlaying ? "#1d4ed8" : "#6b7280",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  {isCurrentPlaying ? "⏸" : "▶"}
                </button>
              ) : (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    border: "1px dashed #d1d5db",
                    backgroundColor: "#f3f4f6",
                    color: "#9ca3af",
                    fontSize: 12,
                  }}
                >
                  -
                </div>
              )}
            </div>
          );
        })}
      </div>
    </td>
  );
}

type SortField = "score" | "name" | "studentId" | "class";
type SortOrder = "asc" | "desc";

export default function PracticeOverview() {
  const toast = useToast();
  const [mode, setMode] = useState<"practice" | "exam">("practice");
  const [questionType, setQuestionType] = useState<string>("all");
  const [selectedQuestion, setSelectedQuestion] = useState<string>("all");
  const [filterClass, setFilterClass] = useState<string>("all"); // 班级筛选移到上方

  // 学生明细的筛选、排序、分页
  const [detailFilterGrade, setDetailFilterGrade] = useState<string>("all");
  const [detailSearchKeyword, setDetailSearchKeyword] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>("score");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const detailPageSize = 10;

  // API数据状态
  const [studentAnswers, setStudentAnswers] = useState<StudentAnswerResponse[]>(
    []
  );
  const [questions, setQuestions] = useState<Array<{id: string; title: string; type: string}>>([]);
  const [, setLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [gradingRecord, setGradingRecord] = useState<StudentDetail | null>(null);
  const [gradingScore, setGradingScore] = useState("");
  const [gradingMaxScore, setGradingMaxScore] = useState("25");
  const [gradingFeedback, setGradingFeedback] = useState("");
  const [savingScore, setSavingScore] = useState(false);

  // 听选信息展开状态
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // 共享音频播放状态
  const audioRef = useMemo(() => new Audio(), []);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingIndex, setPlayingIndex] = useState<number>(-1);
  const [currentPlayingUrl, setCurrentPlayingUrl] = useState<string | null>(null);

  // 共享音频播放函数
  const playAudio = (url: string, index: number = 0) => {
    if (!url) return;

    const isCrossOrigin = () => {
      try {
        return new URL(url).origin !== window.location.origin;
      } catch {
        return true;
      }
    };

    const playWithUrl = (src: string) => {
      audioRef.src = src;
      audioRef.load();
      const playPromise = audioRef.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setIsPlaying(true);
          setPlayingIndex(index);
          setCurrentPlayingUrl(url);
        }).catch((err) => {
          console.error("[AudioPlayer] Play failed:", err.name, err.message);
        });
      }
    };

    if (isCrossOrigin()) {
      const token = localStorage.getItem('token');
      const proxyUrl = getAudioProxyUrl(url);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      fetch(proxyUrl, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal
      })
        .then((res) => {
          clearTimeout(timeoutId);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.blob();
        })
        .then((blob) => {
          if (blob.size === 0) throw new Error("Empty blob");
          const objectUrl = URL.createObjectURL(blob);
          playWithUrl(objectUrl);
        })
        .catch((err) => {
          clearTimeout(timeoutId);
          console.error("[AudioPlayer] Proxy fetch failed:", err.message);
        });
    } else {
      playWithUrl(url);
    }
  };

  // 切换播放/停止
  const togglePlay = (url: string, index: number) => {
    if (currentPlayingUrl === url && isPlaying) {
      audioRef.pause();
    } else {
      playAudio(url, index);
    }
  };

  // 音频事件监听
  useEffect(() => {
    const audio = audioRef;
    audio.onended = () => {
      setIsPlaying(false);
      setPlayingIndex(-1);
    };
    audio.onpause = () => {
      setIsPlaying(false);
      setPlayingIndex(-1);
    };
    audio.onerror = () => {
      setIsPlaying(false);
      setPlayingIndex(-1);
    };
    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [audioRef]);

  // 加载题目列表
  useEffect(() => {
    loadQuestions();
  }, [mode, questionType]);

  const loadQuestions = async () => {
    try {
      const params: any = {
        skip: 0,
        limit: 1000,
      };
      
      if (mode === "exam") {
        params.mode = "exam";
        params.type = "exam";
      } else {
        params.mode = "practice";
        if (questionType !== "all") {
          params.type = questionType;
        }
      }

      const response = await request.get<{
        code: number;
        message: string;
        data: {
          total: number;
          items: Array<{
            id: number;
            title: string;
            mode: string;
            type: string;
          }>;
        };
      }>("/questions", { params });

      if (response.code === 200 && response.data) {
        const formattedQuestions = response.data.items.map((q) => ({
          id: q.id.toString(),
          title: q.title,
          type: q.type,
        }));
        setQuestions(formattedQuestions);
      }
    } catch (error) {
      console.error("Failed to load questions:", error);
      setQuestions([]);
      setDataError("题目列表加载失败，请检查后端服务后重试。");
    }
  };

  // 根据筛选条件过滤题目
  const filteredQuestions = useMemo(
    () =>
      questions.filter((q) => {
        if (mode === "exam") {
          return q.type === "exam";
        } else {
          return (
            q.type !== "exam" &&
            (questionType === "all" || q.type === questionType)
          );
        }
      }),
    [mode, questionType, questions]
  );

  // 从API加载数据
  useEffect(() => {
    loadStudentAnswers();
  }, [mode, questionType, selectedQuestion]);

  const loadStudentAnswers = async () => {
    setLoading(true);
    setDataError(null);
    try {
      const params: any = {
        skip: 0,
        limit: 1000, // 获取足够多的数据用于前端筛选
      };

      // 如果选择了具体题目，添加题目筛选
      if (selectedQuestion !== "all") {
        params.question_id = parseInt(selectedQuestion);
      }

      // 如果选择了等级，添加等级筛选
      if (detailFilterGrade !== "all") {
        params.grade = detailFilterGrade;
      }

      // 如果有搜索关键词，添加搜索
      if (detailSearchKeyword) {
        params.search = detailSearchKeyword;
      }

      // 根据 mode 和 questionType 添加筛选
      if (mode === "exam") {
        params.mode = "exam";
      } else {
        params.mode = "practice";
        if (questionType !== "all") {
          params.question_type = questionType;
        }
      }

      const response = await request.get<{
        code: number;
        message: string;
        data: {
        total: number;
        items: StudentAnswerResponse[];
        };
      }>("/student-answers", { params });

      if (response.code === 200 && response.data) {
        setStudentAnswers(response.data.items || []);
      } else {
        throw new Error(response.message || "获取数据失败");
      }
    } catch (error) {
      console.error("Failed to load student answers:", error);
      setStudentAnswers([]);
      setDataError("答题数据加载失败，未展示模拟数据。请检查服务连接后重试。");
    } finally {
      setLoading(false);
    }
  };

  // 将API数据转换为前端使用的格式（每条答题记录单独一行，显示题目信息）
  const baseStudentDetails = useMemo(() => {
    if (studentAnswers.length > 0) {
      // 每条答题记录作为单独一行，不再按学生分组
      return studentAnswers.map((answer) => {
        // 优先使用 audio_urls，否则用 audio_url
        const audioUrls = answer.audio_urls || (answer.audio_url ? [answer.audio_url] : []);
        const primaryAudioUrl = audioUrls[0] || "";

        return {
          id: `${answer.id}`,
          studentId: answer.student_student_id || "",
          name: answer.student_name || "",
          class: answer.student_class || "未知班级",
          score: answer.score ?? null,
          maxScore: answer.max_score ?? null,
          grade: (answer.grade || "未评分") as StudentDetail["grade"],
          status: answer.status,
          audioUrl: primaryAudioUrl,
          audioUrls: audioUrls,
          questionTitle: answer.question_title || "未知题目",
          questionType: answer.question_type,
        };
      });
    }
    return [];
  }, [studentAnswers]);

  // 获取所有班级（用于筛选）
  const allClasses = useMemo(() => {
    const classes = new Set(baseStudentDetails.map((s) => s.class));
    return Array.from(classes).sort();
  }, [baseStudentDetails]);

  // 根据班级筛选后的学生数据（用于统计指标）
  const filteredStudentDetails = useMemo(() => {
    if (filterClass === "all") {
      return baseStudentDetails;
    }
    return baseStudentDetails.filter((s) => s.class === filterClass);
  }, [baseStudentDetails, filterClass]);

  // 学生明细的筛选和排序（在班级筛选基础上进一步筛选）
  const filteredAndSortedDetails = useMemo(() => {
    let result = [...filteredStudentDetails];

    // 筛选
    if (detailFilterGrade !== "all") {
      result = result.filter((s) => s.grade === detailFilterGrade);
    }
    if (detailSearchKeyword) {
      const keyword = detailSearchKeyword.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(keyword) ||
          s.studentId.toLowerCase().includes(keyword) ||
          s.class.toLowerCase().includes(keyword)
      );
    }

    // 排序
    result.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortField) {
        case "score":
          aVal = a.score ?? -1;
          bVal = b.score ?? -1;
          break;
        case "name":
          aVal = a.name;
          bVal = b.name;
          break;
        case "studentId":
          aVal = a.studentId;
          bVal = b.studentId;
          break;
        case "class":
          aVal = a.class;
          bVal = b.class;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [
    filteredStudentDetails,
    detailFilterGrade,
    detailSearchKeyword,
    sortField,
    sortOrder,
  ]);

  // 分页
  const paginatedDetails = useMemo(() => {
    const start = (currentPage - 1) * detailPageSize;
    const end = start + detailPageSize;
    return filteredAndSortedDetails.slice(start, end);
  }, [filteredAndSortedDetails, currentPage]);

  const totalDetailPages = Math.ceil(
    filteredAndSortedDetails.length / detailPageSize
  );

  // 计算统计数据（基于班级筛选后的数据）
  const gradedDetails = filteredStudentDetails.filter((s) => s.score !== null);
  const gradedCount = gradedDetails.length;
  const excellentCount = filteredStudentDetails.filter(
    (s) => s.grade === "优秀"
  ).length;
  const passCount = filteredStudentDetails.filter(
    (s) => s.grade === "及格"
  ).length;
  const lowCount = filteredStudentDetails.filter(
    (s) => s.grade === "低分"
  ).length;

  const excellentRate =
    gradedCount > 0
      ? ((excellentCount / gradedCount) * 100).toFixed(1)
      : "0.0";
  const passRate =
    gradedCount > 0 ? ((passCount / gradedCount) * 100).toFixed(1) : "0.0";
  const lowRate =
    gradedCount > 0 ? ((lowCount / gradedCount) * 100).toFixed(1) : "0.0";

  // 等级分布数据（用于饼图）
  const gradeDistribution = useMemo(
    () => [
      {
        name: "优秀",
        value: excellentCount,
        rate: parseFloat(excellentRate),
        color: "#10b981",
      },
      {
        name: "及格",
        value: passCount,
        rate: parseFloat(passRate),
        color: "#3b82f6",
      },
      {
        name: "低分",
        value: lowCount,
        rate: parseFloat(lowRate),
        color: "#f97316",
      },
    ],
    [excellentCount, passCount, lowCount, excellentRate, passRate, lowRate]
  );

  // 成绩分布数据（用于柱状图，基于班级筛选后的数据）
  const scoreDistribution = useMemo(
    () => [
      {
        range: "0-60",
        count: gradedDetails.filter((s) => (s.score ?? 0) < 60).length,
      },
      {
        range: "60-70",
        count: gradedDetails.filter(
          (s) => (s.score ?? 0) >= 60 && (s.score ?? 0) < 70
        ).length,
      },
      {
        range: "70-80",
        count: gradedDetails.filter(
          (s) => (s.score ?? 0) >= 70 && (s.score ?? 0) < 80
        ).length,
      },
      {
        range: "80-90",
        count: gradedDetails.filter(
          (s) => (s.score ?? 0) >= 80 && (s.score ?? 0) < 90
        ).length,
      },
      {
        range: "90-100",
        count: gradedDetails.filter((s) => (s.score ?? 0) >= 90).length,
      },
    ],
    [filteredStudentDetails]
  );

  // 处理排序
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
    setCurrentPage(1);
  };

  const openGrading = (student: StudentDetail) => {
    setGradingRecord(student);
    setGradingScore(student.score === null ? "" : String(student.score));
    setGradingMaxScore(String(
      student.maxScore
      ?? (student.questionType ? DEFAULT_MAX_SCORE_BY_TYPE[student.questionType] : undefined)
      ?? 100
    ));
    setGradingFeedback("");
  };

  const saveManualScore = async () => {
    if (!gradingRecord) return;
    const score = Number(gradingScore);
    const maxScore = Number(gradingMaxScore);
    if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0 || score < 0 || score > maxScore) {
      toast.warning("请输入有效分数，得分需在 0 到满分之间");
      return;
    }
    setSavingScore(true);
    try {
      await request.put(`/student-answers/${gradingRecord.id}/score`, {
        score,
        max_score: maxScore,
        feedback: gradingFeedback,
      });
      toast.success("人工评分已保存");
      setGradingRecord(null);
      await loadStudentAnswers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "评分保存失败");
    } finally {
      setSavingScore(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: 20, marginBottom: 12 }}>学习情况</h2>
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 20 }}>
        查看学生的练习和考试情况，支持按模式、题型、题目进行筛选分析。
      </p>

      {/* 筛选条件 */}
      <section
        style={{
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          backgroundColor: "#ffffff",
          padding: "1.25rem 1.5rem",
          marginBottom: 16,
        }}
      >
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
          筛选条件
        </h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          {/* 模式选择 */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 12,
                color: "#6b7280",
                marginBottom: 6,
              }}
            >
              模式
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setMode("practice");
                  setQuestionType("all");
                  setSelectedQuestion("all");
                }}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  backgroundColor: mode === "practice" ? "#eff6ff" : "#ffffff",
                  color: mode === "practice" ? "#1d4ed8" : "#4b5563",
                  fontSize: 13,
                  cursor: "pointer",
                  fontWeight: mode === "practice" ? 600 : 400,
                }}
              >
                练习
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("exam");
                  setQuestionType("all");
                  setSelectedQuestion("all");
                }}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  backgroundColor: mode === "exam" ? "#eff6ff" : "#ffffff",
                  color: mode === "exam" ? "#1d4ed8" : "#4b5563",
                  fontSize: 13,
                  cursor: "pointer",
                  fontWeight: mode === "exam" ? 600 : 400,
                }}
              >
                考试
              </button>
            </div>
          </div>

          {/* 题型选择（仅练习模式显示） */}
          {mode === "practice" && (
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  color: "#6b7280",
                  marginBottom: 6,
                }}
              >
                题型
              </label>
              <select
                value={questionType}
                onChange={(e) => {
                  setQuestionType(e.target.value);
                  setSelectedQuestion("all");
                }}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  backgroundColor: "#ffffff",
                  fontSize: 13,
                  cursor: "pointer",
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

          {/* 题目选择 */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 12,
                color: "#6b7280",
                marginBottom: 6,
              }}
            >
              题目
            </label>
            <select
              value={selectedQuestion}
              onChange={(e) => setSelectedQuestion(e.target.value)}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                backgroundColor: "#ffffff",
                fontSize: 13,
                cursor: "pointer",
                minWidth: 200,
              }}
            >
              <option value="all">全部题目</option>
              {filteredQuestions.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title}
                </option>
              ))}
            </select>
          </div>

          {/* 班级筛选 */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 12,
                color: "#6b7280",
                marginBottom: 6,
              }}
            >
              班级
            </label>
            <select
              value={filterClass}
              onChange={(e) => {
                setFilterClass(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                backgroundColor: "#ffffff",
                fontSize: 13,
                cursor: "pointer",
                minWidth: 140,
              }}
            >
              <option value="all">全部班级</option>
              {allClasses.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>
        </div>

        {dataError && (
          <div style={{ marginBottom: 16, padding: "0.75rem 1rem", borderRadius: 8, backgroundColor: "#fef2f2", color: "#991b1b", fontSize: 13 }}>
            {dataError}
          </div>
        )}
      </section>

      {/* 统计图表 - 饼图和柱状图并排 */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 20,
        }}
      >
        {/* 等级分布饼图 */}
        <div
          style={{
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            backgroundColor: "#ffffff",
            padding: "1rem 1.2rem",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 12,
              color: "#6b7280",
            }}
          >
            等级分布
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={gradeDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry: any) =>
                  `${entry.name}: ${entry.rate}% (${entry.value}人)`
                }
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {gradeDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, _name: string, props: any) => {
                  const payload = props.payload as {
                    rate: number;
                    name: string;
                  };
                  return [`${payload.rate}% (${value}人)`, payload.name];
                }}
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend
                formatter={(value, entry: any) => {
                  const payload = entry.payload as { rate: number };
                  return (
                    <span style={{ color: entry.color, fontSize: 12 }}>
                      {value}: {payload.rate}%
                    </span>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 成绩分布柱状图 */}
        <div
          style={{
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            backgroundColor: "#ffffff",
            padding: "1rem 1.2rem",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 12,
              color: "#6b7280",
            }}
          >
            成绩分布
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={scoreDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="range" stroke="#6b7280" fontSize={11} />
              <YAxis stroke="#6b7280" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="count"
                fill="#3b82f6"
                radius={[6, 6, 0, 0]}
                name="人数"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 学生答题明细 */}
      <section
        style={{
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          backgroundColor: "#ffffff",
          padding: "1.25rem 1.5rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 600 }}>学生答题明细</h3>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            共 <strong>{filteredAndSortedDetails.length}</strong> 条记录
          </div>
        </div>

        {/* 明细筛选条件 */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <input
            type="text"
            value={detailSearchKeyword}
            onChange={(e) => {
              setDetailSearchKeyword(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="搜索姓名/学号/班级"
            style={{
              padding: "0.4rem 0.75rem",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              fontSize: 12,
              width: 180,
            }}
          />
          <select
            value={detailFilterGrade}
            onChange={(e) => {
              setDetailFilterGrade(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              padding: "0.4rem 0.75rem",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              fontSize: 12,
              cursor: "pointer",
              minWidth: 100,
            }}
          >
            <option value="all">全部等级</option>
            <option value="优秀">优秀</option>
            <option value="及格">及格</option>
            <option value="低分">低分</option>
            <option value="未评分">未评分</option>
          </select>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
          >
            <thead style={{ backgroundColor: "#f9fafb" }}>
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    padding: "0.6rem 0.8rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    userSelect: "none",
                    width: "100px",
                  }}
                  onClick={() => handleSort("studentId")}
                >
                  学号{" "}
                  {sortField === "studentId" &&
                    (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "0.6rem 0.8rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    userSelect: "none",
                    width: "100px",
                  }}
                  onClick={() => handleSort("name")}
                >
                  姓名{" "}
                  {sortField === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "0.6rem 0.8rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    userSelect: "none",
                    width: "110px",
                  }}
                  onClick={() => handleSort("class")}
                >
                  班级{" "}
                  {sortField === "class" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "0.6rem 0.8rem",
                    fontWeight: 600,
                    width: "200px",
                  }}
                >
                  题目
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "0.6rem 0.8rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    userSelect: "none",
                    width: "100px",
                  }}
                  onClick={() => handleSort("score")}
                >
                  得分{" "}
                  {sortField === "score" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th
                  style={{
                    textAlign: "center",
                    padding: "0.6rem 0.8rem",
                    fontWeight: 600,
                    width: "80px",
                  }}
                >
                  等级
                </th>
                <th
                  style={{
                    textAlign: "center",
                    padding: "0.6rem 0.8rem",
                    fontWeight: 600,
                    width: "80px",
                  }}
                >
                  语音
                </th>
                <th style={{ textAlign: "center", padding: "0.6rem 0.8rem", fontWeight: 600, width: "90px" }}>
                  评分
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedDetails.length > 0 ? (
                paginatedDetails.map((student) => (
                  <>
                    <tr
                      key={student.id}
                      style={{ borderTop: "1px solid #f3f4f6" }}
                    >
                      <td style={{ padding: "0.6rem 0.8rem" }}>
                        {student.studentId}
                      </td>
                      <td style={{ padding: "0.6rem 0.8rem" }}>{student.name}</td>
                      <td style={{ padding: "0.6rem 0.8rem" }}>
                        {student.class}
                      </td>
                      <td
                        style={{
                          padding: "0.6rem 0.8rem",
                          fontSize: 12,
                          maxWidth: 200,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={student.questionTitle}
                      >
                        {student.questionTitle}
                      </td>
                      <td
                        style={{
                          padding: "0.6rem 0.8rem",
                          textAlign: "right",
                          fontWeight: 500,
                        }}
                      >
                        {student.score === null ? "—" : `${student.score} / ${student.maxScore || "—"}`}
                      </td>
                      <td
                        style={{ padding: "0.6rem 0.8rem", textAlign: "center" }}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0.2rem 0.6rem",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 500,
                            backgroundColor: student.grade === "未评分"
                              ? "#f3f4f6"
                              :
                              student.grade === "优秀"
                                ? "#dbeafe"
                                : student.grade === "及格"
                                ? "#d1fae5"
                                : "#fee2e2",
                            color: student.grade === "未评分"
                              ? "#6b7280"
                              :
                              student.grade === "优秀"
                                ? "#1e40af"
                                : student.grade === "及格"
                                ? "#065f46"
                                : "#991b1b",
                          }}
                        >
                          {student.grade}
                        </span>
                      </td>
                      <td
                        style={{ padding: "0.6rem 0.8rem", textAlign: "center" }}
                      >
                        <AudioPlayer
                          questionType={student.questionType}
                          isExpanded={expandedRowId === student.id}
                          onToggleExpand={() => {
                            setExpandedRowId(
                              expandedRowId === student.id ? null : student.id
                            );
                          }}
                          audioUrl={student.audioUrl}
                          isPlaying={(student.questionType !== 'listening' && student.questionType !== 'answering') && currentPlayingUrl === student.audioUrl && isPlaying}
                          onPlay={togglePlay}
                        />
                      </td>
                      <td style={{ padding: "0.6rem 0.8rem", textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => openGrading(student)}
                          style={{ border: "1px solid #bfdbfe", backgroundColor: "#eff6ff", color: "#1d4ed8", borderRadius: 6, padding: "0.3rem 0.65rem", cursor: "pointer", fontSize: 12 }}
                        >
                          {student.score === null ? "评分" : "修改"}
                        </button>
                      </td>
                    </tr>
                    {/* 听选信息/回答问题/短文复述及提问展开行 */}
                    {(student.questionType === 'listening' || student.questionType === 'answering' || student.questionType === 'retelling') && expandedRowId === student.id && (
                      <tr
                        key={`${student.id}-expanded`}
                        style={{ backgroundColor: "#f9fafb" }}
                      >
                        <ExpandRow
                          audioUrls={student.audioUrls}
                          playingIndex={playingIndex}
                          isPlaying={isPlaying}
                          onPlay={togglePlay}
                          slotCount={student.questionType === 'listening' ? 6 : student.questionType === 'retelling' ? 3 : 4}
                        />
                      </tr>
                    )}
                  </>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      padding: "2rem",
                      textAlign: "center",
                      color: "#9ca3af",
                    }}
                  >
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {gradingRecord && (
          <div style={{ marginTop: 16, padding: "1rem", border: "1px solid #bfdbfe", borderRadius: 10, backgroundColor: "#f8fbff" }}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>
              人工评分 · {gradingRecord.name} · {gradingRecord.questionTitle}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end" }}>
              <label style={{ fontSize: 12 }}>得分
                <input type="number" min="0" value={gradingScore} onChange={(e) => setGradingScore(e.target.value)} style={{ display: "block", width: 90, marginTop: 4, padding: "0.45rem", border: "1px solid #d1d5db", borderRadius: 6 }} />
              </label>
              <label style={{ fontSize: 12 }}>满分
                <input type="number" min="1" value={gradingMaxScore} onChange={(e) => setGradingMaxScore(e.target.value)} style={{ display: "block", width: 90, marginTop: 4, padding: "0.45rem", border: "1px solid #d1d5db", borderRadius: 6 }} />
              </label>
              <label style={{ fontSize: 12, flex: "1 1 240px" }}>评语（可选）
                <input value={gradingFeedback} onChange={(e) => setGradingFeedback(e.target.value)} placeholder="例如：发音清楚，注意语调" style={{ display: "block", width: "100%", marginTop: 4, padding: "0.45rem", border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }} />
              </label>
              <button type="button" onClick={saveManualScore} disabled={savingScore} style={{ padding: "0.5rem 0.9rem", border: 0, borderRadius: 6, backgroundColor: "#2563eb", color: "white", cursor: savingScore ? "wait" : "pointer" }}>
                {savingScore ? "保存中…" : "保存评分"}
              </button>
              <button type="button" onClick={() => setGradingRecord(null)} style={{ padding: "0.5rem 0.9rem", border: "1px solid #d1d5db", borderRadius: 6, backgroundColor: "white", cursor: "pointer" }}>取消</button>
            </div>
          </div>
        )}

        {/* 分页 */}
        {totalDetailPages > 1 && (
          <div
            style={{
              padding: "1rem 0 0",
              borderTop: "1px solid #f3f4f6",
              marginTop: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              第 {currentPage} / {totalDetailPages} 页
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: "0.4rem 0.8rem",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  backgroundColor: currentPage === 1 ? "#f9fafb" : "#ffffff",
                  color: currentPage === 1 ? "#9ca3af" : "#4b5563",
                  fontSize: 12,
                  cursor: currentPage === 1 ? "not-allowed" : "pointer",
                }}
              >
                上一页
              </button>
              <button
                type="button"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalDetailPages, p + 1))
                }
                disabled={currentPage === totalDetailPages}
                style={{
                  padding: "0.4rem 0.8rem",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  backgroundColor:
                    currentPage === totalDetailPages ? "#f9fafb" : "#ffffff",
                  color:
                    currentPage === totalDetailPages ? "#9ca3af" : "#4b5563",
                  fontSize: 12,
                  cursor:
                    currentPage === totalDetailPages
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
