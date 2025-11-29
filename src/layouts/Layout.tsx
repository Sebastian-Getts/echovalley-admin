import { Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          padding: '1rem 2rem',
          backgroundColor: '#1890ff',
          color: '#fff',
        }}
      >
        <h1>EchoValley Admin</h1>
      </header>
      <main style={{ flex: 1, padding: '2rem' }}>
        <Outlet />
      </main>
      <footer
        style={{
          padding: '1rem 2rem',
          textAlign: 'center',
          backgroundColor: '#f0f0f0',
          borderTop: '1px solid #ddd',
        }}
      >
        <p>© 2025 EchoValley Admin. All rights reserved.</p>
      </footer>
    </div>
  )
}

