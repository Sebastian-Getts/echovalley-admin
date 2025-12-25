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

// 题型选项
const QUESTION_TYPES = [
  { value: "imitation", label: "模仿朗读" },
  { value: "listening", label: "听选信息" },
  { value: "answering", label: "回答问题" },
  { value: "retelling", label: "短文复述及提问" },
] as const;

// Mock 数据：题目列表
const mockQuestions = [
  { id: "q1", title: "Unit 1 - 日常对话练习", type: "imitation" },
  { id: "q2", title: "Unit 2 - 校园生活", type: "listening" },
  { id: "q3", title: "Unit 3 - 家庭话题", type: "answering" },
  { id: "q4", title: "Unit 4 - 综合测试", type: "retelling" },
  { id: "exam1", title: "期中考试 - 综合测试卷", type: "exam" },
  { id: "exam2", title: "期末考试 - 综合测试卷", type: "exam" },
];

// 学生数据类型
interface StudentDetail {
  id: string;
  studentId: string;
  name: string;
  class: string;
  score: number;
  grade: "优秀" | "及格" | "低分";
  audioUrl: string;
}

// API返回的答题记录类型
interface StudentAnswerResponse {
  id: number;
  student_id: number;
  question_id: number;
  student_name?: string;
  student_student_id?: string;
  question_title?: string;
  score?: number;
  max_score?: number;
  grade?: string;
  audio_url?: string;
  status: string;
  submitted_at: string;
}

// Mock 学生答题明细数据（根据不同的筛选条件会有不同的数据）
const generateMockData = (
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
      let newScore = student.score;
      // 模拟不同题目的难度差异
      if (selectedQuestion === "q1") {
        newScore = Math.max(60, student.score - 5 + (index % 3) * 3);
      } else if (selectedQuestion === "q2") {
        newScore = Math.max(60, student.score - 3 + (index % 2) * 2);
      } else if (selectedQuestion === "exam1" || selectedQuestion === "exam2") {
        newScore = Math.max(50, student.score - 8 + (index % 4) * 2);
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

// 语音播放组件
function AudioPlayer({
  audioUrl: _audioUrl,
  studentName,
}: {
  audioUrl: string;
  studentName: string;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [audio] = useState(() => {
    // 创建 mock 音频对象（实际应该使用真实的音频 URL）
    const audioObj = new Audio();
    // 使用一个静音的 data URL 作为 mock，避免实际网络请求
    // 实际使用时，audioUrl 应该是真实的学生录音 URL
    audioObj.src =
      "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZijYIG2i77+efTRAMUKfj8LZjHAY4kdfyzHksBSR3x/DdkEAKFF606euoVRQKRp/g8r5sIQUrgc7y2Yo2CBtou+/nn00QDFCn4/C2YxwGOJHX8sx5LAUkd8fw3ZBAC"; // Mock 静音音频
    audioObj.onended = () => setIsPlaying(false);
    audioObj.onpause = () => setIsPlaying(false);
    // 只在真正加载失败时设置错误，而不是在播放过程中
    audioObj.onerror = () => {
      // 检查是否是真正的加载错误
      if (audioObj.readyState === 0) {
        setHasError(true);
        setIsPlaying(false);
      }
    };
    return audioObj;
  });

  const handlePlay = () => {
    if (hasError) {
      alert("音频加载失败（当前为 mock 数据，请等待真实接口接入）");
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      // 如果音频还未加载，先加载
      if (audio.readyState === 0) {
        audio.load();
      }
      audio
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((err) => {
          // 只在真正的播放错误时提示，忽略用户交互相关的错误
          if (err.name !== "NotAllowedError" && err.name !== "AbortError") {
            setHasError(true);
            setIsPlaying(false);
          }
        });
    }
  };

  return (
    <button
      type="button"
      onClick={handlePlay}
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
      title={`播放 ${studentName} 的录音`}
    >
      {isPlaying ? "⏸" : "▶"}
    </button>
  );
}

type SortField = "score" | "name" | "studentId" | "class";
type SortOrder = "asc" | "desc";

export default function PracticeOverview() {
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
  const [loading, setLoading] = useState(false);
  const [useApiData, setUseApiData] = useState(true); // 是否使用API数据，如果API失败则回退到mock数据

  // 根据筛选条件过滤题目
  const filteredQuestions = useMemo(
    () =>
      mockQuestions.filter((q) => {
        if (mode === "exam") {
          return q.type === "exam";
        } else {
          return (
            q.type !== "exam" &&
            (questionType === "all" || q.type === questionType)
          );
        }
      }),
    [mode, questionType]
  );

  // 从API加载数据
  useEffect(() => {
    if (useApiData) {
      loadStudentAnswers();
    }
  }, [mode, questionType, selectedQuestion, useApiData]);

  const loadStudentAnswers = async () => {
    setLoading(true);
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

      const response = await request.get<{
        total: number;
        items: StudentAnswerResponse[];
      }>("/v1/student-answers", { params });

      setStudentAnswers(response.items || []);
    } catch (error) {
      console.error("Failed to load student answers:", error);
      // API失败时回退到mock数据
      setUseApiData(false);
    } finally {
      setLoading(false);
    }
  };

  // 将API数据转换为前端使用的格式
  const baseStudentDetails = useMemo(() => {
    if (useApiData && studentAnswers.length > 0) {
      // 从API数据转换
      return studentAnswers
        .filter((answer) => {
          // 根据mode和questionType筛选
          // 这里需要根据实际的题目类型来筛选，暂时先返回所有数据
          return true;
        })
        .map((answer) => ({
          id: answer.id.toString(),
          studentId: answer.student_student_id || "",
          name: answer.student_name || "",
          class: "未知班级", // API中没有班级信息，需要从student表关联获取
          score: answer.score || 0,
          grade: (answer.grade || "低分") as "优秀" | "及格" | "低分",
          audioUrl: answer.audio_url || "",
        }));
    } else {
      // 使用mock数据
      return generateMockData(mode, questionType, selectedQuestion);
    }
  }, [useApiData, studentAnswers, mode, questionType, selectedQuestion]);

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
          aVal = a.score;
          bVal = b.score;
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
  const totalStudents = filteredStudentDetails.length;
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
    totalStudents > 0
      ? ((excellentCount / totalStudents) * 100).toFixed(1)
      : "0.0";
  const passRate =
    totalStudents > 0 ? ((passCount / totalStudents) * 100).toFixed(1) : "0.0";
  const lowRate =
    totalStudents > 0 ? ((lowCount / totalStudents) * 100).toFixed(1) : "0.0";

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
        count: filteredStudentDetails.filter((s) => s.score < 60).length,
      },
      {
        range: "60-70",
        count: filteredStudentDetails.filter(
          (s) => s.score >= 60 && s.score < 70
        ).length,
      },
      {
        range: "70-80",
        count: filteredStudentDetails.filter(
          (s) => s.score >= 70 && s.score < 80
        ).length,
      },
      {
        range: "80-90",
        count: filteredStudentDetails.filter(
          (s) => s.score >= 80 && s.score < 90
        ).length,
      },
      {
        range: "90-100",
        count: filteredStudentDetails.filter((s) => s.score >= 90).length,
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
              </tr>
            </thead>
            <tbody>
              {paginatedDetails.length > 0 ? (
                paginatedDetails.map((student) => (
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
                        textAlign: "right",
                        fontWeight: 500,
                      }}
                    >
                      {student.score} 分
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
                          backgroundColor:
                            student.grade === "优秀"
                              ? "#dbeafe"
                              : student.grade === "及格"
                              ? "#d1fae5"
                              : "#fee2e2",
                          color:
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
                        audioUrl={student.audioUrl}
                        studentName={student.name}
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
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
