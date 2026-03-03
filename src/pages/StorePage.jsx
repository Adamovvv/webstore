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
  const [adImageUrl, setAdImageUrl] = useState('')
  const [openedProductId, setOpenedProductId] = useState(null)
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
    const fetchStoreData = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })
      const { data: settingsData, error: settingsError } = await supabase
        .from('store_settings')
        .select('ad_image_url')
        .eq('id', 1)
        .maybeSingle()

      if (error) {
        console.error(error)
      } else {
        setProducts(data || [])
      }

      if (settingsError) {
        console.error(settingsError)
      } else {
        setAdImageUrl(settingsData?.ad_image_url || '')
      }
      setLoading(false)
    }

    fetchStoreData()
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
            <div className="search-input-wrap">
              <span className="search-icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="presentation">
                  <path d="M11 2C15.968 2 20 6.032 20 11C20 15.968 15.968 20 11 20C6.032 20 2 15.968 2 11C2 6.032 6.032 2 11 2ZM11 18C14.8675 18 18 14.8675 18 11C18 7.1325 14.8675 4 11 4C7.1325 4 4 7.1325 4 11C4 14.8675 7.1325 18 11 18ZM19.4853 18.0711L22.3137 20.8995L20.8995 22.3137L18.0711 19.4853L19.4853 18.0711Z" />
                </svg>
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск тарифа или оператора..."
              />
            </div>
          </div>
          {adImageUrl ? (
            <a className="ad-banner" href={adImageUrl} target="_blank" rel="noreferrer">
              <img src={adImageUrl} alt="Рекламный баннер" />
            </a>
          ) : null}
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

          <div className="products-list">
            {filtered.map((item) => {
              const discount = getDiscount(item.old_price, item.price)
              const isOpen = openedProductId === item.id
              return (
                <article
                  key={item.id}
                  className={isOpen ? 'list-card open' : 'list-card'}
                >
                  <button
                    type="button"
                    className="list-card-main"
                    onClick={() => setOpenedProductId(isOpen ? null : item.id)}
                    aria-expanded={isOpen}
                  >
                    <div>
                      <p className="provider">{item.provider}</p>
                      <h3>{item.title}</h3>
                      <p className="meta">{item.data_gb} GB</p>
                    </div>
                    <div className="list-price-col">
                      <strong>{formatPrice(item.price)} ₽</strong>
                      {item.old_price ? <span className="old-price">{formatPrice(item.old_price)} ₽</span> : null}
                      {discount ? <span className="discount">{discount}% скидка</span> : null}
                      <span className="list-toggle">{isOpen ? 'Свернуть ▲' : 'Подробнее ▼'}</span>
                    </div>
                  </button>
                  <div className={isOpen ? 'list-card-details open' : 'list-card-details'}>
                    <div className="details-inner">
                      <p className="modal-row"><span>Категория</span><strong>{item.category || '-'}</strong></p>
                      <p className="modal-row"><span>Трафик</span><strong>{item.data_gb ?? '-'} GB</strong></p>
                      {item.badge ? <p className="modal-row"><span>Метка</span><strong>{item.badge}</strong></p> : null}
                      <div className="modal-description">
                        <p className="modal-description-title">Описание</p>
                        <p>{item.description || 'Описание пока не добавлено.'}</p>
                      </div>
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
