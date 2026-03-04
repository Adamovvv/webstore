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

function getTrafficLabel(item) {
  return item?.is_unlimited ? 'Безлимит' : `${item?.data_gb ?? '-'} GB`
}

function getMonthlyPayment(item) {
  const amount = item?.monthly_payment ?? item?.price
  return amount != null ? `${formatPrice(amount)} ₽` : '-'
}

function formatWhatsappLabel(value) {
  const digits = (value || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 11 && digits.startsWith('7')) {
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`
  }
  return `+${digits}`
}

const faqItems = [
  {
    question: 'Как быстро подключается тариф?',
    answer: 'Обычно подключение занимает от 5 до 15 минут после подтверждения заявки.',
  },
  {
    question: 'Можно ли сохранить текущий номер?',
    answer: 'Да, вы можете выбрать тариф с переносом номера. Мы подскажем шаги при оформлении.',
  },
  {
    question: 'Есть ли безлимитный интернет?',
    answer: 'Да, в каталоге есть тарифы с безлимитным интернетом. Они помечены в карточке.',
  },
  {
    question: 'Как связаться с менеджером?',
    answer: 'Нажмите на WhatsApp вверху страницы и напишите нам, ответим в рабочее время.',
  },
]

export default function StorePage() {
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth > 768 : false)
  const [products, setProducts] = useState([])
  const [filtered, setFiltered] = useState([])
  const [adImageUrl, setAdImageUrl] = useState('')
  const [openedProductId, setOpenedProductId] = useState(null)
  const [activeCategory, setActiveCategory] = useState('Все')
  const [search, setSearch] = useState('')
  const [activeFaqIndex, setActiveFaqIndex] = useState(null)
  const [loading, setLoading] = useState(true)
  const [qrData, setQrData] = useState('')
  const whatsappNumber = '79280013099'
  const whatsappLabel = formatWhatsappLabel(whatsappNumber)
  const whatsappHref = `https://wa.me/${whatsappNumber.replace(/\D/g, '')}`

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
            <a className="whatsapp-link" href={whatsappHref} target="_blank" rel="noreferrer" aria-label="WhatsApp">
              <span className="whatsapp-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="presentation">
                  <path d="M20.52 3.48A11.82 11.82 0 0 0 12.03 0C5.42 0 .03 5.39.03 12c0 2.12.56 4.2 1.61 6.03L0 24l6.16-1.6A11.96 11.96 0 0 0 12.03 24c6.6 0 11.97-5.39 11.97-12 0-3.2-1.24-6.21-3.48-8.52Zm-8.49 18.5c-1.81 0-3.59-.49-5.14-1.41l-.37-.22-3.66.95.98-3.57-.24-.37A9.9 9.9 0 0 1 2.03 12c0-5.51 4.48-10 10-10 2.67 0 5.19 1.04 7.07 2.93A9.92 9.92 0 0 1 22.03 12c0 5.52-4.48 10-10 10Zm5.49-7.49c-.3-.15-1.76-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.49-.9-.8-1.5-1.79-1.68-2.09-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49 0 1.47 1.07 2.89 1.22 3.09.15.2 2.1 3.2 5.09 4.48.71.31 1.27.49 1.7.63.72.23 1.38.2 1.9.12.58-.09 1.76-.72 2.01-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z" />
                </svg>
              </span>
              <span>{whatsappLabel}</span>
            </a>
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
            <h2>{loading ? 'Loading...' : 'Доступные тарифы'}</h2>
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
                      <p className="provider">Метка: {item.badge || '—'}</p>
                      <h3>{item.title}</h3>
                      <p className="meta">{item.provider || '—'}</p>
                    </div>
                    <div className="list-price-col">
                      <strong>{item.price != null ? `${formatPrice(item.price)} ₽` : '-'}</strong>
                      {item.old_price ? <span className="old-price">{formatPrice(item.old_price)} ₽</span> : null}
                      {discount ? <span className="discount">{discount}% скидка</span> : null}
                      <span className="list-toggle">{isOpen ? 'Свернуть ▲' : 'Подробнее ▼'}</span>
                    </div>
                  </button>
                  <div className={isOpen ? 'list-card-details open' : 'list-card-details'}>
                    <div className="details-inner">
                      <p className="modal-row"><span>Трафик</span><strong>{getTrafficLabel(item)}</strong></p>
                      <p className="modal-row"><span>Минуты</span><strong>{item.minutes ?? 0}</strong></p>
                      <p className="modal-row"><span>SMS</span><strong>{item.sms ?? 0}</strong></p>
                      <p className="modal-row"><span>Ежемесячный платеж</span><strong>{getMonthlyPayment(item)}</strong></p>
                      {item.badge ? <p className="modal-row"><span>Метка</span><strong>{item.badge}</strong></p> : null}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          {!loading && filtered.length === 0 ? <p className="empty">No products found. Add items in the admin panel.</p> : null}
        </section>

        <section className="why-us">
          <h2>Почему выбирают нас?</h2>
          <div className="why-us-list">
            <article className="why-card">
              <h3>⚡ Подключение в день обращения</h3>
              <p>Подбираем тариф и запускаем подключение без долгих ожиданий.</p>
            </article>
            <article className="why-card">
              <h3>🛡️ Честные условия</h3>
              <p>Показываем все платежи заранее, без скрытых списаний и сюрпризов.</p>
            </article>
            <article className="why-card">
              <h3>💬 Поддержка в WhatsApp</h3>
              <p>Быстро отвечаем по тарифам, подключению и вопросам после покупки.</p>
            </article>
          </div>
        </section>

        <section className="faq-section">
          <h2>FAQ</h2>
          <div className="faq-list">
            {faqItems.map((item, index) => {
              const isOpen = activeFaqIndex === index
              return (
                <article key={item.question} className={isOpen ? 'faq-item open' : 'faq-item'}>
                  <button
                    type="button"
                    className="faq-question"
                    aria-expanded={isOpen}
                    onClick={() => setActiveFaqIndex(isOpen ? null : index)}
                  >
                    <span>{item.question}</span>
                    <span>{isOpen ? '−' : '+'}</span>
                  </button>
                  <div className={isOpen ? 'faq-answer open' : 'faq-answer'}>
                    <p>{item.answer}</p>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      </section>
    </main>
  )
}
