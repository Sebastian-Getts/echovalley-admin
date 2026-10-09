export type AdminEnvironment = 'development' | 'production'

const ENVIRONMENT_KEY = 'echovalley:admin-environment'

export function getAdminEnvironment(): AdminEnvironment {
  return localStorage.getItem(ENVIRONMENT_KEY) === 'development' ? 'development' : 'production'
}

export function setAdminEnvironment(environment: AdminEnvironment) {
  localStorage.setItem(ENVIRONMENT_KEY, environment)
}

export function getApiBaseURL() {
  return getAdminEnvironment() === 'development' ? '/api-dev/v1' : '/api/v1'
}

export function environmentLabel() {
  return getAdminEnvironment() === 'development' ? '开发环境' : '正式环境'
}

export function storageKey(name: string) {
  return `echovalley:${getAdminEnvironment()}:${name}`
}
