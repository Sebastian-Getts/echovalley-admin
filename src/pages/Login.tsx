import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { APP_TITLE, ROUTES, STORAGE_KEYS } from "../constants";
import request from "../utils/request";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username || !password) {
      setError("请输入账号和密码");
      return;
    }

    setSubmitting(true);
    try {
      const response = await request.post<{
        code: number;
        message: string;
        data: {
          token: string;
          user: {
            id: number;
            name: string;
            username: string;
            role: string;
          };
        };
      }>("/auth/login", {
        username,
        password,
      });

      if (response.code === 200 && response.data) {
        localStorage.setItem(STORAGE_KEYS.TOKEN, response.data.token);
        localStorage.setItem(
          STORAGE_KEYS.USER_INFO,
          JSON.stringify(response.data.user)
        );
        navigate(ROUTES.HOME, { replace: true });
      } else {
        setError(response.message || "登录失败");
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || "登录失败，请检查网络连接");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #e6f7ff 0%, #f9f0ff 50%, #fff1f0 100%)",
        padding: "2rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          backgroundColor: "#ffffff",
          boxShadow: "0 18px 45px rgba(15, 35, 95, 0.15)",
          borderRadius: 24,
          padding: "2.5rem 2.75rem",
        }}
      >
        <header style={{ marginBottom: "2rem" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: 16,
              background:
                "radial-gradient(circle at 0 0, #69c0ff 0, #40a9ff 40%, #2f54eb 100%)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 22,
              marginBottom: 12,
            }}
          >
            桂
          </div>
          <h1
            style={{
              fontSize: 24,
              marginBottom: 6,
              color: "#1f2933",
            }}
          >
            桂园听说 · 教师管理后台
          </h1>
          <p style={{ color: "#6b7280", fontSize: 13 }}>
            专为中学英语听力口语练习设计，教师在这里管理学生帐号、题目与练习数据。
          </p>
        </header>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1rem" }}>
            <label
              htmlFor="username"
              style={{
                display: "block",
                marginBottom: 6,
                fontSize: 13,
                color: "#374151",
              }}
            >
              教师账号
            </label>
            <input
              id="username"
              type="text"
              placeholder="请输入教师账号"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: "0.75rem" }}>
            <label
              htmlFor="password"
              style={{
                display: "block",
                marginBottom: 6,
                fontSize: 13,
                color: "#374151",
              }}
            >
              登录密码
            </label>
            <input
              id="password"
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>

          {error && (
            <div
              style={{
                marginBottom: "0.75rem",
                padding: "0.5rem 0.75rem",
                borderRadius: 8,
                backgroundColor: "#fef2f2",
                color: "#b91c1c",
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%",
              marginTop: "0.5rem",
              padding: "0.6rem 0.75rem",
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              background:
                "linear-gradient(145deg, #2563eb 0%, #1d4ed8 30%, #7c3aed 100%)",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {submitting ? "正在验证..." : "登录"}
          </button>

        </form>

        <footer
          style={{
            marginTop: "1.75rem",
            fontSize: 11,
            color: "#9ca3af",
            textAlign: "center",
          }}
        >
          {APP_TITLE}
        </footer>
      </div>
    </div>
  );
}
