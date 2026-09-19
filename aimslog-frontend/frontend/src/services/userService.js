import api from './api'

export function getUsers(params = {}) {
  return api.get('/users', { params }).then((res) => res.data)
}
