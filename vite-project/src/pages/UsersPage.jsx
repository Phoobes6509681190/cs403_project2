import { useEffect, useState } from 'react'
import api from '../services/api'

const initialForm = { name: '', username: '', password: '', role: 'user' }

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  async function loadUsers() {
    const { data } = await api.get('/users')
    setUsers(data.users || [])
  }

  useEffect(() => {
    let active = true
    api.get('/users')
      .then(({ data }) => { if (active) setUsers(data.users || []) })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'โหลดรายชื่อผู้ใช้ไม่สำเร็จ') })
    return () => { active = false }
  }, [])

  async function createUser(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api.post('/users', form)
      setForm(initialForm)
      setNotice('สร้างบัญชีผู้ใช้แล้ว')
      await loadUsers()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'สร้างบัญชีไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  return (
    <div className="page-stack">
      {(error || notice) && <div className={`notice ${error ? 'error-notice' : 'success-notice'}`} role={error ? 'alert' : 'status'}>{error || notice}</div>}
      <div className="page-section users-layout">
        <form className="user-form" onSubmit={createUser}>
          <div><p className="eyebrow">ACCESS MANAGEMENT</p><h2>สร้างบัญชี</h2></div>
          <label htmlFor="user-name">ชื่อที่แสดง</label>
          <input autoComplete="name" id="user-name" name="name" onChange={updateField} required value={form.name} />
          <label htmlFor="user-username">ชื่อผู้ใช้</label>
          <input autoComplete="username" id="user-username" name="username" onChange={updateField} required value={form.username} />
          <label htmlFor="user-password">รหัสผ่าน</label>
          <input autoComplete="new-password" id="user-password" minLength={8} name="password" onChange={updateField} required type="password" value={form.password} />
          <label htmlFor="user-role">สิทธิ์</label>
          <select id="user-role" name="role" onChange={updateField} value={form.role}>
            <option value="user">กรรมการ / ผู้ใช้</option>
            <option value="admin">ผู้ดูแลระบบ</option>
          </select>
          <button className="button button-primary full-button" disabled={busy} type="submit">สร้างผู้ใช้</button>
        </form>
        <section className="user-list">
          <div className="page-section-heading"><div><p className="eyebrow">REGISTERED USERS</p><h2>ผู้ใช้ในระบบ</h2></div><span className="count-badge">{users.length}</span></div>
          <div className="simple-table-wrap"><table className="simple-table"><thead><tr><th>ชื่อ</th><th>Username</th><th>สิทธิ์</th></tr></thead><tbody>
            {users.map((user) => <tr key={user._id}><td>{user.name}</td><td>{user.username}</td><td><span className={`role-label role-${user.role}`}>{user.role === 'admin' ? 'Admin' : 'User'}</span></td></tr>)}
          </tbody></table></div>
        </section>
      </div>
    </div>
  )
}