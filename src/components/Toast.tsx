import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastContextType {
  showToast: (type: ToastType, message: string, duration?: number) => void
  success: (message: string, duration?: number) => void
  error: (message: string, duration?: number) => void
  warning: (message: string, duration?: number) => void
  info: (message: string, duration?: number) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showToast = useCallback((type: ToastType, message: string, duration = 3000) => {
    const id = Math.random().toString(36).substring(7)
    const toast: Toast = { id, type, message, duration }

    setToasts(prev => [...prev, toast])

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
  }, [removeToast])

  const success = useCallback((message: string, duration?: number) => {
    showToast('success', message, duration)
  }, [showToast])

  const error = useCallback((message: string, duration?: number) => {
    showToast('error', message, duration)
  }, [showToast])

  const warning = useCallback((message: string, duration?: number) => {
    showToast('warning', message, duration)
  }, [showToast])

  const info = useCallback((message: string, duration?: number) => {
    showToast('info', message, duration)
  }, [showToast])

  // ESC 键关闭所有提示
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setToasts([])
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

interface ToastContainerProps {
  toasts: Toast[]
  onRemove: (id: string) => void
}

const ToastContainer = ({ toasts, onRemove }: ToastContainerProps) => {
  return (
    <div style={containerStyle}>
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}

interface ToastItemProps {
  toast: Toast
  onRemove: (id: string) => void
}

const ToastItem = ({ toast, onRemove }: ToastItemProps) => {
  const [isExiting, setIsExiting] = useState(false)

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => onRemove(toast.id), 300)
  }

  useEffect(() => {
    return () => {}
  }, [])

  const config = getToastConfig(toast.type)

  return (
    <div
      style={{
        ...toastStyle,
        backgroundColor: config.bgColor,
        borderLeftColor: config.borderColor,
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? 'translateX(100%)' : 'translateX(0)',
      }}
    >
      <div style={contentStyle}>
        <span style={{ fontSize: 18, marginRight: 8 }}>{config.icon}</span>
        <span style={messageStyle}>{toast.message}</span>
      </div>
      <button
        onClick={handleClose}
        style={closeButtonStyle}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.1)'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        ✕
      </button>
    </div>
  )
}

const getToastConfig = (type: ToastType) => {
  switch (type) {
    case 'success':
      return {
        icon: '✓',
        bgColor: '#f0fdf4',
        borderColor: '#22c55e',
        textColor: '#15803d',
      }
    case 'error':
      return {
        icon: '✕',
        bgColor: '#fef2f2',
        borderColor: '#ef4444',
        textColor: '#dc2626',
      }
    case 'warning':
      return {
        icon: '⚠',
        bgColor: '#fffbeb',
        borderColor: '#f59e0b',
        textColor: '#d97706',
      }
    case 'info':
      return {
        icon: 'ℹ',
        bgColor: '#eff6ff',
        borderColor: '#3b82f6',
        textColor: '#2563eb',
      }
  }
}

// 样式定义
const containerStyle: React.CSSProperties = {
  position: 'fixed',
  top: 20,
  right: 20,
  zIndex: 10000,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  maxWidth: 400,
}

const toastStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderRadius: 8,
  borderLeft: 4,
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  fontSize: 14,
  fontWeight: 500,
  minWidth: 300,
  transition: 'all 0.3s ease',
  animation: 'slideIn 0.3s ease',
}

const contentStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flex: 1,
}

const messageStyle: React.CSSProperties = {
  color: '#374151',
  wordBreak: 'break-word',
}

const closeButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  fontSize: 16,
  cursor: 'pointer',
  padding: '4px 8px',
  marginLeft: 12,
  borderRadius: 4,
  color: '#6b7280',
  transition: 'background-color 0.2s',
}
