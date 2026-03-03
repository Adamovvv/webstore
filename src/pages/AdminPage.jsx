import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const initialForm = {
  title: '',
  provider: '',
  category: 'eSIM',
  image_url: '',
  badge: '',
  data_gb: 10,
  duration_days: 30,
  price: 499,
  old_price: 699,
}

export default function AdminPage() {
  const [session, setSession] = useState(null)
  const [credentials, setCredentials] = useState({ email: '', password: '' })
  const [authLoading, setAuthLoading] = useState(true)

  const [products, setProducts] = useState([])
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const setupAuth = async () => {
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
      setAuthLoading(false)
    }

    setupAuth()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const fetchProducts = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false })
    if (error) {
      alert(error.message)
    } else {
      setProducts(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    if (session) {
      fetchProducts()
    }
  }, [session])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: name.includes('price') || name.includes('days') || name.includes('gb') ? Number(value) : value }))
  }

  const handleCreds = (event) => {
    const { name, value } = event.target
    setCredentials((prev) => ({ ...prev, [name]: value }))
  }

  const signIn = async (event) => {
    event.preventDefault()
    setAuthLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    })
    if (error) {
      alert(error.message)
    }
    setAuthLoading(false)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const resetForm = () => {
    setForm(initialForm)
    setEditingId(null)
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)

    const payload = {
      ...form,
      old_price: form.old_price || null,
      badge: form.badge || null,
      image_url: form.image_url || null,
    }

    if (editingId) {
      const { error } = await supabase.from('products').update(payload).eq('id', editingId)
      if (error) alert(error.message)
    } else {
      const { error } = await supabase.from('products').insert(payload)
      if (error) alert(error.message)
    }

    await fetchProducts()
    resetForm()
    setSubmitting(false)
  }

  const onEdit = (item) => {
    setEditingId(item.id)
    setForm({
      title: item.title || '',
      provider: item.provider || '',
      category: item.category || 'eSIM',
      image_url: item.image_url || '',
      badge: item.badge || '',
      data_gb: item.data_gb ?? 0,
      duration_days: item.duration_days ?? 0,
      price: item.price ?? 0,
      old_price: item.old_price ?? 0,
    })
  }

  const onDelete = async (id) => {
    const ok = window.confirm('Delete this product?')
    if (!ok) return
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) {
      alert(error.message)
      return
    }
    await fetchProducts()
  }

  if (authLoading && !session) {
    return (
      <main className="admin-page">
        <section className="admin-shell">
          <p>Loading...</p>
        </section>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="admin-page">
        <section className="admin-shell">
          <header className="admin-header">
            <h1>Admin Login</h1>
            <p>Sign in with Supabase user credentials.</p>
          </header>

          <form className="admin-form" onSubmit={signIn}>
            <input type="email" name="email" value={credentials.email} onChange={handleCreds} placeholder="Email" required />
            <input type="password" name="password" value={credentials.password} onChange={handleCreds} placeholder="Password" required />
            <div className="admin-actions">
              <button type="submit" disabled={authLoading}>{authLoading ? 'Signing in...' : 'Sign in'}</button>
            </div>
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="admin-page">
      <section className="admin-shell">
        <header className="admin-header">
          <h1>Admin Panel</h1>
          <p>Manage SIM products: create, update, delete.</p>
          <button type="button" className="sign-out" onClick={signOut}>Sign out</button>
        </header>

        <form className="admin-form" onSubmit={onSubmit}>
          <input name="title" value={form.title} onChange={handleChange} placeholder="Product title" required />
          <input name="provider" value={form.provider} onChange={handleChange} placeholder="Provider" required />
          <select name="category" value={form.category} onChange={handleChange}>
            <option value="eSIM">eSIM</option>
            <option value="Travel">Travel</option>
            <option value="Local">Local</option>
            <option value="Unlimited">Unlimited</option>
          </select>
          <input name="image_url" value={form.image_url} onChange={handleChange} placeholder="Image URL" />
          <input name="badge" value={form.badge} onChange={handleChange} placeholder="Badge (new / bestseller...)" />
          <input type="number" name="data_gb" value={form.data_gb} onChange={handleChange} placeholder="Data (GB)" required />
          <input type="number" name="duration_days" value={form.duration_days} onChange={handleChange} placeholder="Duration (days)" required />
          <input type="number" name="price" value={form.price} onChange={handleChange} placeholder="Price" required />
          <input type="number" name="old_price" value={form.old_price} onChange={handleChange} placeholder="Old price" />

          <div className="admin-actions">
            <button type="submit" disabled={submitting}>{submitting ? 'Saving...' : editingId ? 'Update' : 'Create'}</button>
            {editingId ? <button type="button" onClick={resetForm}>Cancel edit</button> : null}
          </div>
        </form>

        <section className="admin-list">
          <h2>Products</h2>
          {loading ? <p>Loading...</p> : null}
          {!loading && products.length === 0 ? <p>No products yet.</p> : null}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Provider</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((item) => (
                  <tr key={item.id}>
                    <td>{item.title}</td>
                    <td>{item.provider}</td>
                    <td>{item.category}</td>
                    <td>?{item.price}</td>
                    <td className="row-actions">
                      <button type="button" onClick={() => onEdit(item)}>Edit</button>
                      <button type="button" onClick={() => onDelete(item.id)} className="danger">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  )
}
