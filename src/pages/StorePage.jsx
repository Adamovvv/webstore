import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabaseClient'

const categories = ['Все', 'Мегафон', 'Билайн', 'Мтс', 'Йота']

function formatPrice(value) {
  if (value == null) return ''
  return new Intl.NumberFormat('ru-RU').format(Number(value))
}

function getDiscount(oldPrice, price) {
  if (!oldPrice || !price || oldPrice <= price) return null
  return Math.round(((oldPrice - price) / oldPrice) * 100)
}

export default function StorePage() {
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth > 768 : false)
  const [products, setProducts] = useState([])
  const [filtered, setFiltered] = useState([])
  const [activeCategory, setActiveCategory] = useState('Все')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [qrData, setQrData] = useState('')

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth > 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error(error)
      } else {
        setProducts(data || [])
      }
      setLoading(false)
    }

    fetchProducts()
  }, [])

  useEffect(() => {
    let next = [...products]

    if (activeCategory !== 'Все') {
      next = next.filter((item) => item.category === activeCategory)
    }

    if (search.trim()) {
      const query = search.toLowerCase()
      next = next.filter((item) => {
        return item.title?.toLowerCase().includes(query) || item.provider?.toLowerCase().includes(query)
      })
    }

    setFiltered(next)
  }, [products, activeCategory, search])

  const appUrl = useMemo(() => {
    return import.meta.env.VITE_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')
  }, [])

  useEffect(() => {
    if (!isDesktop || !appUrl) return
    QRCode.toDataURL(appUrl)
      .then((url) => setQrData(url))
      .catch((error) => console.error(error))
  }, [isDesktop, appUrl])

  if (isDesktop) {
    return (
      <main className="desktop-gate">
        <div className="desktop-card">
          <h1>Open on your phone</h1>
          <p>This SIM demo store is mobile-only. Scan the QR code to continue.</p>
          {qrData ? <img src={qrData} alt="QR code" className="qr-code" /> : <div className="qr-skeleton" />}
          <p className="hint">Or open: {appUrl}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="mobile-store">
      <section className="phone-shell">
        <header className="hero">
          <div className="title-row">
            <h1>Красивые номера &amp; Выгодные тарифы</h1>
          </div>
          <div className="search-row">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск тарифа или оператора..."
            />
          </div>
        </header>

        <div className="chips">
            {categories.map((category) => (
              <button
                key={category}
                className={category === activeCategory ? 'chip active' : 'chip'}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

        <section className="products-section">
          <div className="section-head">
            <h2>{loading ? 'Loading...' : `${filtered.length} Товаров`}</h2>
          </div>

          <div className="grid">
            {filtered.map((item) => {
              const discount = getDiscount(item.old_price, item.price)
              return (
                <article key={item.id} className="card">
                  <div className="card-media-wrap">
                    {item.badge ? <span className="badge">{item.badge}</span> : null}
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.title} className="card-media" />
                    ) : (
                      <div className="card-placeholder">No image</div>
                    )}
                  </div>
                  <div className="card-body">
                    <p className="provider">{item.provider}</p>
                    <h3>{item.title}</h3>
                    <p className="meta">{item.data_gb} GB</p>
                    <div className="price-row">
                      <strong>?{formatPrice(item.price)}</strong>
                      {item.old_price ? <span className="old-price">?{formatPrice(item.old_price)}</span> : null}
                      {discount ? <span className="discount">{discount}% off</span> : null}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          {!loading && filtered.length === 0 ? <p className="empty">No products found. Add items in the admin panel.</p> : null}
        </section>
      </section>
    </main>
  )
}



