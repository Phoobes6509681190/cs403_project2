import api from './api'

export function getUsers(params = {}) {
  return api.get('/users', { params }).then((res) => res.data)
}

export function createUser(payload) {
  // payload: { username, name, password, role }
  return api.post('/users', payload).then((res) => res.data)
}
