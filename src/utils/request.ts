import axios, { AxiosRequestConfig, AxiosResponse } from 'axios'
import { getApiBaseURL } from './environment'
import { STORAGE_KEYS } from '../constants'

export interface ApiClient {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>
  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>
}

const loginPath = `${import.meta.env.BASE_URL}login`

// 创建 axios 实例
const axiosInstance = axios.create({
  baseURL: getApiBaseURL(),
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器
axiosInstance.interceptors.request.use(
  (config) => {
    config.baseURL = getApiBaseURL()
    // 可以在这里添加 token 等认证信息
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN)
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    // API 响应格式: { code, message, data }
    // 直接返回 response.data，这样调用方得到的是 { code, message, data }
    const data = response.data
    // 如果响应格式符合 API 文档规范，检查 code
    if (data && typeof data === 'object' && 'code' in data) {
      if (data.code !== 200) {
        // 业务错误，返回错误信息
        return Promise.reject(new Error(data.message || '请求失败'))
      }
      // 返回整个响应对象，调用方可以通过 response.data 访问实际数据
      return data
    }
    return data
  },
  (error) => {
    // 处理错误响应
    if (error.response) {
      const data = error.response.data
      // 如果后端返回了标准格式的错误响应
      if (data && typeof data === 'object' && 'message' in data) {
      switch (error.response.status) {
        case 401:
          // 未授权，清除 token 并跳转到登录页
            localStorage.removeItem(STORAGE_KEYS.TOKEN)
            window.location.href = loginPath
            return Promise.reject(new Error(data.message || '未授权'))
          case 403:
            console.error('没有权限访问')
            return Promise.reject(new Error(data.message || '没有权限访问'))
          case 404:
            console.error('请求的资源不存在')
            return Promise.reject(new Error(data.message || '请求的资源不存在'))
          case 500:
            console.error('服务器错误')
            return Promise.reject(new Error(data.message || '服务器错误'))
          default:
            console.error('请求失败:', error.message)
            return Promise.reject(new Error(data.message || error.message))
        }
      } else {
        // 处理 HTTP 错误
        switch (error.response.status) {
          case 401:
          localStorage.removeItem(STORAGE_KEYS.TOKEN)
          window.location.href = loginPath
          break
        case 403:
          console.error('没有权限访问')
          break
        case 404:
          console.error('请求的资源不存在')
          break
        case 500:
          console.error('服务器错误')
          break
        default:
          console.error('请求失败:', error.message)
        }
      }
    }
    return Promise.reject(error)
  }
)

// The response interceptor unwraps AxiosResponse and returns the API payload.
// Expose that actual contract to callers instead of AxiosInstance's default
// Promise<AxiosResponse<T>> signature.
export default axiosInstance as unknown as ApiClient


