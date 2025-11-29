import { useState, useMemo } from 'react'

// 学生数据类型
interface Student {
  id: string
  studentId: string // 学号
  name: string
  grade: string
  className: string
}

// Mock 学生数据
const initialMockStudents: Student[] = [
  { id: '1', studentId: '2024001', name: '王小明', grade: '初一', className: '1班' },
  { id: '2', studentId: '2024002', name: '李婷婷', grade: '初一', className: '1班' },
  { id: '3', studentId: '2024003', name: '张杰', grade: '初一', className: '1班' },
  { id: '4', studentId: '2024004', name: '刘芳', grade: '初二', className: '2班' },
  { id: '5', studentId: '2024005', name: '陈强', grade: '初二', className: '2班' },
  { id: '6', studentId: '2024006', name: '杨洋', grade: '初二', className: '3班' },
  { id: '7', studentId: '2024007', name: '赵敏', grade: '初三', className: '1班' },
  { id: '8', studentId: '2024008', name: '周杰', grade: '初三', className: '2班' },
  { id: '9', studentId: '2024009', name: '吴磊', grade: '初三', className: '2班' },
  { id: '10', studentId: '2024010', name: '郑爽', grade: '初三', className: '3班' },
  { id: '11', studentId: '2024011', name: '孙丽', grade: '初一', className: '2班' },
  { id: '12', studentId: '2024012', name: '钱多多', grade: '初一', className: '3班' },
]

export default function StudentAccounts() {
  const [students, setStudents] = useState<Student[]>(initialMockStudents)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Student>>({})
  const [isAdding, setIsAdding] = useState(false)
  const [newStudent, setNewStudent] = useState<Partial<Student>>({
    studentId: '',
    name: '',
    grade: '初一',
    className: '',
  })

  // 筛选条件
  const [filterGrade, setFilterGrade] = useState<string>('all')
  const [filterClass, setFilterClass] = useState<string>('all')
  const [searchKeyword, setSearchKeyword] = useState<string>('')

  // 分页
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // 获取所有年级和班级（用于筛选）
  const allGrades = useMemo(() => {
    const grades = new Set(students.map((s) => s.grade))
    return Array.from(grades).sort()
  }, [students])

  const allClasses = useMemo(() => {
    const classes = new Set(students.map((s) => s.className))
    return Array.from(classes).sort()
  }, [students])

  // 筛选后的学生列表
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      if (filterGrade !== 'all' && student.grade !== filterGrade) return false
      if (filterClass !== 'all' && student.className !== filterClass) return false
      if (searchKeyword) {
        const keyword = searchKeyword.toLowerCase()
        return (
          student.name.toLowerCase().includes(keyword) ||
          student.studentId.toLowerCase().includes(keyword) ||
          student.className.toLowerCase().includes(keyword)
        )
      }
      return true
    })
  }, [students, filterGrade, filterClass, searchKeyword])

  // 分页后的学生列表
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    const end = start + pageSize
    return filteredStudents.slice(start, end)
  }, [filteredStudents, currentPage])

  const totalPages = Math.ceil(filteredStudents.length / pageSize)

  // 开始编辑
  const handleStartEdit = (student: Student) => {
    setEditingId(student.id)
    setEditForm({ ...student })
    setIsAdding(false)
  }

  // 保存编辑
  const handleSaveEdit = () => {
    if (!editingId) return
    setStudents(students.map((s) => (s.id === editingId ? { ...editForm, id: editingId } as Student : s)))
    setEditingId(null)
    setEditForm({})
  }

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingId(null)
    setEditForm({})
    setIsAdding(false)
    setNewStudent({ studentId: '', name: '', grade: '初一', className: '' })
  }

  // 删除学生
  const handleDelete = (id: string) => {
    if (confirm('确定要删除该学生吗？')) {
      setStudents(students.filter((s) => s.id !== id))
      if (editingId === id) {
        setEditingId(null)
      }
    }
  }

  // 开始添加
  const handleStartAdd = () => {
    setIsAdding(true)
    setEditingId(null)
    setNewStudent({ studentId: '', name: '', grade: '初一', className: '' })
  }

  // 保存新增
  const handleSaveAdd = () => {
    if (!newStudent.studentId || !newStudent.name || !newStudent.className) {
      alert('请填写完整信息')
      return
    }
    // 检查学号是否重复
    if (students.some((s) => s.studentId === newStudent.studentId)) {
      alert('学号已存在')
      return
    }
    const newId = String(Date.now())
    setStudents([...students, { ...newStudent, id: newId } as Student])
    setIsAdding(false)
    setNewStudent({ studentId: '', name: '', grade: '初一', className: '' })
  }

  // 下载模板
  const handleDownloadTemplate = () => {
    const template = [
      ['学号', '姓名', '年级', '班级'],
      ['2024001', '示例学生1', '初一', '1班'],
      ['2024002', '示例学生2', '初二', '2班'],
    ]
    const csv = template.map((row) => row.join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = '学生导入模板.csv'
    link.click()
  }

  // 导入文件
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const lines = text.split('\n').filter((line) => line.trim())
      const imported: Student[] = []

      // 跳过表头，从第二行开始
      for (let i = 1; i < lines.length; i++) {
        const [studentId, name, grade, className] = lines[i].split(',').map((s) => s.trim())
        if (studentId && name && grade && className) {
          // 检查学号是否已存在
          const exists = students.some((s) => s.studentId === studentId)
          if (!exists) {
            imported.push({
              id: String(Date.now() + i),
              studentId,
              name,
              grade,
              className,
            })
          }
        }
      }

      if (imported.length > 0) {
        setStudents([...students, ...imported])
        alert(`成功导入 ${imported.length} 名学生`)
      } else {
        alert('没有可导入的学生（可能学号重复或格式错误）')
      }
    }
    reader.readAsText(file, 'UTF-8')
    // 重置 input，允许重复选择同一文件
    e.target.value = ''
  }

  // 导出数据
  const handleExport = () => {
    const csv = [
      ['学号', '姓名', '年级', '班级'],
      ...students.map((s) => [s.studentId, s.name, s.grade, s.className]),
    ]
      .map((row) => row.join(','))
      .join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `学生名单_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>学生帐号管理</h2>
          <p style={{ color: '#6b7280', fontSize: 13 }}>
            管理“桂园听说”小程序中的学生账号，当前共有 <strong>{students.length}</strong> 名学生
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={handleDownloadTemplate}
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
            下载模板
          </button>
          <label
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              backgroundColor: '#ffffff',
              color: '#4b5563',
              fontSize: 13,
              cursor: 'pointer',
              display: 'inline-block',
            }}
          >
            导入
            <input
              type="file"
              accept=".csv"
              onChange={handleImport}
              style={{ display: 'none' }}
            />
          </label>
          <button
            type="button"
            onClick={handleExport}
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
            导出
          </button>
          <button
            type="button"
            onClick={handleStartAdd}
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
            + 添加学生
          </button>
        </div>
      </div>

      {/* 筛选条件 */}
      <section
        style={{
          borderRadius: 12,
          border: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
          padding: '1rem 1.25rem',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
              搜索（姓名/学号/班级）
            </label>
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => {
                setSearchKeyword(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="请输入关键词"
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                fontSize: 13,
                width: 200,
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
              年级
            </label>
            <select
              value={filterGrade}
              onChange={(e) => {
                setFilterGrade(e.target.value)
                setCurrentPage(1)
              }}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                fontSize: 13,
                cursor: 'pointer',
                minWidth: 100,
              }}
            >
              <option value="all">全部年级</option>
              {allGrades.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
              班级
            </label>
            <select
              value={filterClass}
              onChange={(e) => {
                setFilterClass(e.target.value)
                setCurrentPage(1)
              }}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                fontSize: 13,
                cursor: 'pointer',
                minWidth: 100,
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
          <div style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280' }}>
            筛选结果：<strong>{filteredStudents.length}</strong> 名学生
          </div>
        </div>
      </section>

      {/* 添加学生表单 */}
      {isAdding && (
        <section
          style={{
            borderRadius: 12,
            border: '1px solid #3b82f6',
            backgroundColor: '#eff6ff',
            padding: '1rem 1.25rem',
            marginBottom: 16,
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>添加新学生</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                学号 *
              </label>
              <input
                type="text"
                value={newStudent.studentId || ''}
                onChange={(e) => setNewStudent({ ...newStudent, studentId: e.target.value })}
                placeholder="请输入学号"
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
                姓名 *
              </label>
              <input
                type="text"
                value={newStudent.name || ''}
                onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                placeholder="请输入姓名"
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
                年级 *
              </label>
              <select
                value={newStudent.grade || '初一'}
                onChange={(e) => setNewStudent({ ...newStudent, grade: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <option value="初一">初一</option>
                <option value="初二">初二</option>
                <option value="初三">初三</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                班级 *
              </label>
              <input
                type="text"
                value={newStudent.className || ''}
                onChange={(e) => setNewStudent({ ...newStudent, className: e.target.value })}
                placeholder="如：1班"
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  fontSize: 13,
                }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              onClick={handleSaveAdd}
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
              onClick={handleCancelEdit}
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
        </section>
      )}

      {/* 学生列表 */}
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
                <th style={{ textAlign: 'left', padding: '0.6rem 0.9rem', fontWeight: 600 }}>学号</th>
                <th style={{ textAlign: 'left', padding: '0.6rem 0.9rem', fontWeight: 600 }}>姓名</th>
                <th style={{ textAlign: 'left', padding: '0.6rem 0.9rem', fontWeight: 600 }}>年级</th>
                <th style={{ textAlign: 'left', padding: '0.6rem 0.9rem', fontWeight: 600 }}>班级</th>
                <th style={{ textAlign: 'center', padding: '0.6rem 0.9rem', fontWeight: 600 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {paginatedStudents.length > 0 ? (
                paginatedStudents.map((student) =>
                  editingId === student.id ? (
                    <tr key={student.id} style={{ borderTop: '1px solid #f3f4f6', backgroundColor: '#eff6ff' }}>
                      <td style={{ padding: '0.6rem 0.9rem' }}>
                        <input
                          type="text"
                          value={editForm.studentId || ''}
                          onChange={(e) => setEditForm({ ...editForm, studentId: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.4rem 0.6rem',
                            borderRadius: 6,
                            border: '1px solid #e5e7eb',
                            fontSize: 13,
                          }}
                        />
                      </td>
                      <td style={{ padding: '0.6rem 0.9rem' }}>
                        <input
                          type="text"
                          value={editForm.name || ''}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.4rem 0.6rem',
                            borderRadius: 6,
                            border: '1px solid #e5e7eb',
                            fontSize: 13,
                          }}
                        />
                      </td>
                      <td style={{ padding: '0.6rem 0.9rem' }}>
                        <select
                          value={editForm.grade || ''}
                          onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.4rem 0.6rem',
                            borderRadius: 6,
                            border: '1px solid #e5e7eb',
                            fontSize: 13,
                            cursor: 'pointer',
                          }}
                        >
                          <option value="初一">初一</option>
                          <option value="初二">初二</option>
                          <option value="初三">初三</option>
                        </select>
                      </td>
                      <td style={{ padding: '0.6rem 0.9rem' }}>
                        <input
                          type="text"
                          value={editForm.className || ''}
                          onChange={(e) => setEditForm({ ...editForm, className: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.4rem 0.6rem',
                            borderRadius: 6,
                            border: '1px solid #e5e7eb',
                            fontSize: 13,
                          }}
                        />
                      </td>
                      <td style={{ padding: '0.6rem 0.9rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            style={{
                              padding: '0.3rem 0.6rem',
                              borderRadius: 6,
                              border: 'none',
                              backgroundColor: '#10b981',
                              color: '#ffffff',
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >
                            保存
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            style={{
                              padding: '0.3rem 0.6rem',
                              borderRadius: 6,
                              border: '1px solid #e5e7eb',
                              backgroundColor: '#ffffff',
                              color: '#4b5563',
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >
                            取消
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={student.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.6rem 0.9rem' }}>{student.studentId}</td>
                      <td style={{ padding: '0.6rem 0.9rem' }}>{student.name}</td>
                      <td style={{ padding: '0.6rem 0.9rem' }}>{student.grade}</td>
                      <td style={{ padding: '0.6rem 0.9rem' }}>{student.className}</td>
                      <td style={{ padding: '0.6rem 0.9rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(student)}
                            style={{
                              padding: '0.3rem 0.6rem',
                              borderRadius: 6,
                              border: '1px solid #e5e7eb',
                              backgroundColor: '#ffffff',
                              color: '#3b82f6',
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(student.id)}
                            style={{
                              padding: '0.3rem 0.6rem',
                              borderRadius: 6,
                              border: '1px solid #e5e7eb',
                              backgroundColor: '#ffffff',
                              color: '#ef4444',
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )
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
              共 {filteredStudents.length} 条，第 {currentPage} / {totalPages} 页
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
