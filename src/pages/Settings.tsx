export default function Settings() {
  return (
    <div>
      <h2 style={{ fontSize: 20, marginBottom: 12 }}>系统设置</h2>
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>
        配置“桂园听说”教师端的一些基础参数，如班级管理、练习时间段、评分规则等（当前为占位页面）。
      </p>
      <div
        style={{
          borderRadius: 12,
          border: "1px dashed #d1d5db",
          backgroundColor: "#f9fafb",
          padding: "1.25rem 1.5rem",
          fontSize: 13,
          color: "#4b5563",
        }}
      >
        后续可以在这里配置：
        <ul style={{ marginTop: 8, paddingLeft: 20 }}>
          <li>班级与教师绑定关系</li>
          <li>学生是否允许自行注册 / 仅通过导入</li>
          <li>听力与口语任务的开放时间与频率</li>
          <li>成绩权重、评分规则等高级设置</li>
        </ul>
      </div>
    </div>
  );
}
