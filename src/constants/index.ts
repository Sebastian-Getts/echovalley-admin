// 应用常量配置

export const APP_TITLE = import.meta.env.VITE_APP_TITLE || 'EchoValley Admin'

// 存储键名
export const STORAGE_KEYS = {
  TOKEN: 'token',
  USER_INFO: 'userInfo',
} as const

// 路由路径
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
} as const

