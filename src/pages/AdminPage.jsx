import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const initialForm = {
  title: '',
  provider: 'megafon',
  category: 'megafon',
  is_unlimited: false,
  badge: '',
  data_gb: '',
  price: '',
  minutes: '',
  sms: '',
  monthly_payment: '',
  old_price: '',
}

export default function AdminPage() {
  const [session, setSession] = useState(null)
  const [credentials, setCredentials] = useState({ email: '', password: '' })
  const [authLoading, setAuthLoading] = useState(true)

  const [products, setProducts] = useState([])
  const [adBanners, setAdBanners] = useState([])
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [adUploading, setAdUploading] = useState(false)
  const [bannerUploading, setBannerUploading] = useState({})
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
      .select('ad_image_url, ad_banners')
      .eq('id', 1)
      .maybeSingle()

    if (error) {
      alert(error.message)
      return
    }

    const nextBanners = Array.isArray(data?.ad_banners)
      ? data.ad_banners
      : data?.ad_image_url
        ? [data.ad_image_url]
        : []
    const normalized = nextBanners
      .map((item, index) => ({
        id: typeof item === 'object' && item?.id ? item.id : `banner-${index}-${Date.now()}`,
        url: typeof item === 'string' ? item : item?.url || '',
      }))
      .filter((item) => item.url)

    setAdBanners(normalized.length > 0 ? normalized : [{ id: `banner-${Date.now()}`, url: '' }])
  }

  useEffect(() => {
    if (session) {
      fetchProducts()
      fetchStoreSettings()
    }
  }, [session])

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : name.includes('price') || name.includes('gb') ? Number(value) : value,
    }))
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
      is_unlimited: !!form.is_unlimited,
      data_gb: form.is_unlimited ? 0 : Number(form.data_gb),
      price: Number(form.price) || 0,
      minutes: Number(form.minutes) || 0,
      sms: Number(form.sms) || 0,
      monthly_payment: Number(form.monthly_payment) || 0,
      old_price: form.old_price || null,
      badge: form.badge || null,
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
      provider: item.provider || 'megafon',
      category: item.category || 'megafon',
      is_unlimited: item.is_unlimited ?? false,
      badge: item.badge || '',
      data_gb: item.data_gb ?? 0,
      price: item.price ?? 0,
      minutes: item.minutes ?? 0,
      sms: item.sms ?? 0,
      monthly_payment: item.monthly_payment ?? item.price ?? 0,
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

  const updateBannerUrl = (id, value) => {
    setAdBanners((prev) => prev.map((item) => (item.id === id ? { ...item, url: value } : item)))
  }

  const addBanner = () => {
    setAdBanners((prev) => [...prev, { id: `banner-${Date.now()}`, url: '' }])
  }

  const removeBanner = (id) => {
    setAdBanners((prev) => prev.filter((item) => item.id !== id))
  }

  const moveBanner = (id, direction) => {
    setAdBanners((prev) => {
      const index = prev.findIndex((item) => item.id === id)
      if (index < 0) return prev
      const target = direction === 'up' ? index - 1 : index + 1
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      const current = next[index]
      next[index] = next[target]
      next[target] = current
      return next
    })
  }

  const onAdFileChange = async (event, id) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!session?.user) {
      alert('Сессия истекла. Войдите в админку заново.')
      return
    }

    setAdUploading(true)
    setBannerUploading((prev) => ({ ...prev, [id]: true }))
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png'
    const path = `ads/${Date.now()}-${crypto.randomUUID()}.${fileExt}`
    const { error: uploadError } = await supabase.storage.from('store-assets').upload(path, file, {
      upsert: false,
      cacheControl: '3600',
    })

    if (uploadError) {
      alert(`Ошибка загрузки: ${uploadError.message}`)
      setAdUploading(false)
      setBannerUploading((prev) => ({ ...prev, [id]: false }))
      return
    }

    const { data } = supabase.storage.from('store-assets').getPublicUrl(path)
    updateBannerUrl(id, data.publicUrl)
    setAdUploading(false)
    setBannerUploading((prev) => ({ ...prev, [id]: false }))
  }

  const saveAdBanners = async () => {
    setAdSaving(true)
    const urls = adBanners.map((item) => item.url.trim()).filter(Boolean)
    const { error } = await supabase
      .from('store_settings')
      .upsert({ id: 1, ad_image_url: urls[0] || null, ad_banners: urls }, { onConflict: 'id' })

    if (error) {
      alert(error.message)
    } else {
      alert('Баннеры сохранены')
    }
    setAdSaving(false)
  }

  if (authLoading && !session) {
    return (
      <main className="admin-page">
        <section className="admin-shell admin-shell-skeleton">
          <div className="skeleton-box skeleton-text-xl" />
          <div className="skeleton-box skeleton-text-md" />
          <div className="admin-form">
            <div className="skeleton-box skeleton-input" />
            <div className="skeleton-box skeleton-input" />
            <div className="skeleton-box skeleton-input" />
            <div className="skeleton-box skeleton-input" />
          </div>
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
          <select name="provider" value={form.provider} onChange={handleChange}>
            <option value="megafon">Мегафон</option>
            <option value="beeline">Билайн</option>
            <option value="mts">МТС</option>
            <option value="yota">Йота</option>
          </select>
          <select name="category" value={form.category} onChange={handleChange}>
            <option value="megafon">Мегафон</option>
            <option value="beeline">Билайн</option>
            <option value="mts">МТС</option>
            <option value="yota">Йота</option>
          </select>
          <input name="badge" value={form.badge} onChange={handleChange} placeholder="Badge (new / bestseller...)" />
          <label className="admin-checkbox">
            <input type="checkbox" name="is_unlimited" checked={!!form.is_unlimited} onChange={handleChange} />
            <span>Безлимитный интернет</span>
          </label>
          <input type="number" name="minutes" value={form.minutes} onChange={handleChange} placeholder="Минуты" required />
          <input type="number" name="sms" value={form.sms} onChange={handleChange} placeholder="SMS" required />
          <input
            type="number"
            name="data_gb"
            value={form.data_gb}
            onChange={handleChange}
            placeholder="Data (GB)"
            required={!form.is_unlimited}
            disabled={!!form.is_unlimited}
          />
          <input type="number" name="price" value={form.price} onChange={handleChange} placeholder="Прайс" required />
          <input
            type="number"
            name="monthly_payment"
            value={form.monthly_payment}
            onChange={handleChange}
            placeholder="Ежемесячный платеж"
            required
          />
          <input type="number" name="old_price" value={form.old_price} onChange={handleChange} placeholder="Old price" />

          <div className="admin-actions">
            <button type="submit" disabled={submitting}>{submitting ? 'Saving...' : editingId ? 'Update' : 'Create'}</button>
            {editingId ? <button type="button" onClick={resetForm}>Cancel edit</button> : null}
          </div>
        </form>

        <section className="admin-ad-settings">
          <h2>Рекламные баннеры</h2>
          <p>Добавляйте несколько баннеров, меняйте порядок и сохраняйте одним кликом.</p>
          <div className="admin-banners-list">
            {adBanners.map((item, index) => (
              <article key={item.id} className="admin-banner-item">
                <div className="admin-banner-head">
                  <strong>Баннер #{index + 1}</strong>
                  <div className="admin-banner-actions">
                    <button type="button" onClick={() => moveBanner(item.id, 'up')} disabled={index === 0}>↑</button>
                    <button type="button" onClick={() => moveBanner(item.id, 'down')} disabled={index === adBanners.length - 1}>↓</button>
                    <button type="button" onClick={() => removeBanner(item.id)} className="danger">Удалить</button>
                  </div>
                </div>
                <div className="admin-form">
                  <input
                    type="url"
                    value={item.url}
                    onChange={(event) => updateBannerUrl(item.id, event.target.value)}
                    placeholder="https://example.com/banner.jpg"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => onAdFileChange(event, item.id)}
                  />
                </div>
                {item.url ? <img src={item.url} alt={`Баннер ${index + 1}`} className="admin-banner-preview" /> : null}
                {bannerUploading[item.id] ? <p className="muted">Uploading...</p> : null}
              </article>
            ))}
            <div className="admin-actions">
              <button type="button" onClick={addBanner}>Добавить баннер</button>
              <button type="button" onClick={saveAdBanners} disabled={adSaving || adUploading}>
                {adSaving ? 'Saving...' : 'Сохранить баннеры'}
              </button>
            </div>
          </div>
        </section>`n</section>
    </main>
  )
}


