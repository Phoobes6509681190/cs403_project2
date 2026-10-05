import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || '/api' })

api.interceptors.request.use((config) => {
  try {
    const session = JSON.parse(localStorage.getItem('aimslog.session'))
    if (session?.token) config.headers.Authorization = `Bearer ${session.token}`
  } catch {
    localStorage.removeItem('aimslog.session')
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('aimslog.session')
      window.dispatchEvent(new Event('aimslog:unauthorized'))
    }
    return Promise.reject(error)
  },
)

export default api