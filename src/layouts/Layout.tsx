import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { APP_TITLE, ROUTES, STORAGE_KEYS } from '../constants'

export default function Layout() {
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEYS.TOKEN)
    localStorage.removeItem(STORAGE_KEYS.USER_INFO)
    navigate(ROUTES.LOGIN, { replace: true })
  }

  const linkBaseStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '0.55rem 0.9rem',
    borderRadius: 10,
    fontSize: 14,
    color: '#4b5563',
    textDecoration: 'none',
    marginBottom: 4,
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f3f4f6',
      }}
    >
      <header
        style={{
          height: 56,
          padding: '0 1.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 12,
              background:
                'radial-gradient(circle at 0 0, #60a5fa 0, #3b82f6 40%, #4f46e5 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            桂
          </span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>桂园听说 · 教师管理后台</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>{APP_TITLE}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          style={{
            border: 'none',
            backgroundColor: 'transparent',
            fontSize: 13,
            color: '#6b7280',
            cursor: 'pointer',
          }}
        >
          退出登录
        </button>
      </header>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <aside
          style={{
            width: 220,
            padding: '1.25rem 1rem 1.75rem',
            borderRight: '1px solid #e5e7eb',
            backgroundColor: '#ffffff',
          }}
        >
          <nav>
            <div
              style={{
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: '#9ca3af',
                marginBottom: 8,
              }}
            >
              教学管理
            </div>
            <NavLink
              to={ROUTES.HOME}
              end
              style={({ isActive }) => ({
                ...linkBaseStyle,
                backgroundColor: isActive ? '#eff6ff' : 'transparent',
                color: isActive ? '#1d4ed8' : linkBaseStyle.color,
                fontWeight: isActive ? 600 : 500,
              })}
            >
              学习情况
            </NavLink>
            <NavLink
              to="students"
              style={({ isActive }) => ({
                ...linkBaseStyle,
                backgroundColor: isActive ? '#eff6ff' : 'transparent',
                color: isActive ? '#1d4ed8' : linkBaseStyle.color,
                fontWeight: isActive ? 600 : 500,
              })}
            >
              学生帐号管理
            </NavLink>
            <NavLink
              to="questions"
              style={({ isActive }) => ({
                ...linkBaseStyle,
                backgroundColor: isActive ? '#eff6ff' : 'transparent',
                color: isActive ? '#1d4ed8' : linkBaseStyle.color,
                fontWeight: isActive ? 600 : 500,
              })}
            >
              题目管理
            </NavLink>
            <div
              style={{
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: '#9ca3af',
                marginTop: 16,
                marginBottom: 8,
              }}
            >
              系统
            </div>
            <NavLink
              to="settings"
              style={({ isActive }) => ({
                ...linkBaseStyle,
                backgroundColor: isActive ? '#eff6ff' : 'transparent',
                color: isActive ? '#1d4ed8' : linkBaseStyle.color,
                fontWeight: isActive ? 600 : 500,
              })}
            >
              设置
            </NavLink>
          </nav>
        </aside>
        <main
          style={{
            flex: 1,
            padding: '1.5rem 2rem 2rem',
            minWidth: 0,
          }}
        >
          <Outlet />
        </main>
      </div>
      <footer
        style={{
          padding: '0.8rem 2rem',
          textAlign: 'right',
          backgroundColor: '#f9fafb',
          borderTop: '1px solid #e5e7eb',
          fontSize: 11,
          color: '#9ca3af',
        }}
      >
        © 2025 桂园听说 · EchoValley Admin
      </footer>
    </div>
  )
}

