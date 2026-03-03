import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const initialForm = {
  title: '',
  provider: '',
  category: 'Мегафон',
  image_url: '',
  description: '',
  badge: '',
  data_gb: '',
  price: '',
  old_price: '',
}

export default function AdminPage() {
  const [session, setSession] = useState(null)
  const [credentials, setCredentials] = useState({ email: '', password: '' })
  const [authLoading, setAuthLoading] = useState(true)

  const [products, setProducts] = useState([])
  const [adImageUrl, setAdImageUrl] = useState('')
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [adUploading, setAdUploading] = useState(false)
  const [adSaving, setAdSaving] = useState(false)

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

  const fetchStoreSettings = async () => {
    const { data, error } = await supabase
      .from('store_settings')
      .select('ad_image_url')
      .eq('id', 1)
      .maybeSingle()

    if (error) {
      alert(error.message)
      return
    }

    setAdImageUrl(data?.ad_image_url || '')
  }

  useEffect(() => {
    if (session) {
      fetchProducts()
      fetchStoreSettings()
    }
  }, [session])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: name.includes('price') || name.includes('gb') ? Number(value) : value }))
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
      description: form.description || null,
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
      description: item.description || '',
      badge: item.badge || '',
      data_gb: item.data_gb ?? 0,
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

  const onAdFileChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!session?.user) {
      alert('Сессия истекла. Войдите в админку заново.')
      return
    }

    setAdUploading(true)
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png'
    const path = `ads/${Date.now()}-${crypto.randomUUID()}.${fileExt}`
    const { error: uploadError } = await supabase.storage.from('store-assets').upload(path, file, {
      upsert: false,
      cacheControl: '3600',
    })

    if (uploadError) {
      alert(`Ошибка загрузки: ${uploadError.message}`)
      setAdUploading(false)
      return
    }

    const { data } = supabase.storage.from('store-assets').getPublicUrl(path)
    setAdImageUrl(data.publicUrl)
    setAdUploading(false)
  }

  const saveAdImage = async () => {
    setAdSaving(true)
    const { error } = await supabase
      .from('store_settings')
      .upsert({ id: 1, ad_image_url: adImageUrl || null }, { onConflict: 'id' })

    if (error) {
      alert(error.message)
    } else {
      alert('Рекламный баннер сохранен')
    }
    setAdSaving(false)
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
            <option value="megafon">Мегафон</option>
            <option value="beeline">Билайн</option>
            <option value="mts">Мтс</option>
            <option value="yota">Йота</option>
          </select>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="Описание товара"
            rows={4}
          />
          <input name="image_url" value={form.image_url} onChange={handleChange} placeholder="Image URL" />
          <input name="badge" value={form.badge} onChange={handleChange} placeholder="Badge (new / bestseller...)" />
          <input type="number" name="data_gb" value={form.data_gb} onChange={handleChange} placeholder="Data (GB)" required />
          <input type="number" name="price" value={form.price} onChange={handleChange} placeholder="Price" required />
          <input type="number" name="old_price" value={form.old_price} onChange={handleChange} placeholder="Old price" />

          <div className="admin-actions">
            <button type="submit" disabled={submitting}>{submitting ? 'Saving...' : editingId ? 'Update' : 'Create'}</button>
            {editingId ? <button type="button" onClick={resetForm}>Cancel edit</button> : null}
          </div>
        </form>

        <section className="admin-ad-settings">
          <h2>Рекламный баннер</h2>
          <p>Загрузите изображение или вставьте URL, затем сохраните.</p>
          <div className="admin-form">
            <input
              type="url"
              value={adImageUrl}
              onChange={(event) => setAdImageUrl(event.target.value)}
              placeholder="https://example.com/banner.jpg"
            />
            <input type="file" accept="image/*" onChange={onAdFileChange} />
            <div className="admin-actions">
              <button type="button" onClick={saveAdImage} disabled={adSaving || adUploading}>
                {adUploading ? 'Uploading...' : adSaving ? 'Saving...' : 'Save banner'}
              </button>
            </div>
          </div>
        </section>

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

