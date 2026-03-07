import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabaseClient'

const categories = ['all', 'megafon', 'beeline', 'mts', 'yota']
const categoryLabels = {
  all: 'Все',
  megafon: 'Мегафон',
  beeline: 'Билайн',
  mts: 'МТС',
  yota: 'Йота',
}

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

function getProviderKey(value) {
  const next = String(value || '').trim().toLowerCase()
  if (next.includes('megafon') || next.includes('мегафон')) return 'megafon'
  if (next.includes('beeline') || next.includes('билайн')) return 'beeline'
  if (next === 'mts' || next.includes('мтс')) return 'mts'
  if (next.includes('yota') || next.includes('йота')) return 'yota'
  return ''
}

const providerLogos = {
  megafon: '/provider-logos/megafon.png',
  beeline: '/provider-logos/beeline.png',
  mts: '/provider-logos/mts.png',
  yota: '/provider-logos/yota.png',
}

function formatWhatsappLabel(value) {
  const digits = (value || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 11 && digits.startsWith('7')) {
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`
  }
  return `+${digits}`
}

function normalizeReviewRow(row) {
  return {
    id: row.id,
    name: row.name || 'Пользователь',
    city: row.city || 'Город не указан',
    rating: Number(row.rating) || 5,
    text: row.text || '',
  }
}

const faqItems = [
  {
    question: 'Сколько времени занимает активация SIM-карты?',
    answer: 'Активация SIM-карты обычно занимает от 20 до 40 минут после подтверждения заказа.',
  },
  {
    question: 'Можно ли выбрать красивый номер?',
    answer: 'Да, в каталоге доступны красивые и запоминающиеся номера разных категорий.'
  },
  {
    question: 'Можно ли сменить тариф позже?',
    answer: 'Да, после подключения вы сможете сменить тариф через оператора.'
  },
  {
    question: 'Работают ли номера по всей России?',
    answer: 'Да, SIM-карты работают по всей России в сети оператора.'
  }
]

export default function StorePage() {
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth > 768 : false)
  const [products, setProducts] = useState([])
  const [filtered, setFiltered] = useState([])
  const [adBanners, setAdBanners] = useState([])
  const [activeBannerIndex, setActiveBannerIndex] = useState(0)
  const [openedProductId, setOpenedProductId] = useState(null)
  const [activeCategory, setActiveCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [activeFaqIndex, setActiveFaqIndex] = useState(null)
  const [reviews, setReviews] = useState([])
  const [activeReviewIndex, setActiveReviewIndex] = useState(0)
  const [reviewForm, setReviewForm] = useState({ name: '', city: '', rating: 5, text: '' })
  const [reviewError, setReviewError] = useState('')
  const [reviewSuccess, setReviewSuccess] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [qrData, setQrData] = useState('')
  const carouselRef = useRef(null)
  const reviewsCarouselRef = useRef(null)
  const whatsappNumber = '79280013099'
  const whatsappLabel = formatWhatsappLabel(whatsappNumber)
  const whatsappHref = `https://wa.me/${whatsappNumber.replace(/\D/g, '')}`
  const loadingCards = [1, 2, 3, 4]
  const loadingFaq = [1, 2, 3]

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth > 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const fetchStoreData = async () => {
      setLoading(true)
      const [
        { data, error },
        { data: settingsData, error: settingsError },
        { data: reviewsData, error: reviewsError },
      ] = await Promise.all([
        supabase.from('products').select('*').order('created_at', { ascending: false }),
        supabase.from('store_settings').select('ad_image_url, ad_banners').eq('id', 1).maybeSingle(),
        supabase.from('reviews').select('id, name, city, rating, text, created_at').order('created_at', { ascending: false }).limit(20),
      ])

      if (error) {
        console.error(error)
      } else {
        setProducts(data || [])
      }

      if (settingsError) {
        console.error(settingsError)
      } else {
        const nextBanners = Array.isArray(settingsData?.ad_banners)
          ? settingsData.ad_banners
          : settingsData?.ad_image_url
            ? [settingsData.ad_image_url]
            : []
        const normalized = nextBanners
          .map((item) => (typeof item === 'string' ? item : item?.url))
          .filter(Boolean)
        setAdBanners(normalized)
      }

      if (reviewsError) {
        console.error(reviewsError)
      } else {
        setReviews((reviewsData || []).map(normalizeReviewRow))
      }
      setLoading(false)
    }

    fetchStoreData()
  }, [])

  useEffect(() => {
    let next = [...products]

    if (activeCategory !== 'all') {
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

  useEffect(() => {
    if (activeBannerIndex >= adBanners.length) {
      setActiveBannerIndex(0)
    }
  }, [adBanners, activeBannerIndex])

  useEffect(() => {
    if (adBanners.length <= 1) return
    const timer = setInterval(() => {
      setActiveBannerIndex((prev) => (prev + 1) % adBanners.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [adBanners.length])

  useEffect(() => {
    const node = carouselRef.current
    if (!node) return
    const slide = node.children[activeBannerIndex]
    if (!slide) return
    node.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' })
  }, [activeBannerIndex])

  useEffect(() => {
    if (activeReviewIndex >= reviews.length) {
      setActiveReviewIndex(0)
    }
  }, [reviews, activeReviewIndex])

  useEffect(() => {
    if (reviews.length <= 1) return
    const timer = setInterval(() => {
      setActiveReviewIndex((prev) => (prev + 1) % reviews.length)
    }, 4500)
    return () => clearInterval(timer)
  }, [reviews.length])

  useEffect(() => {
    const node = reviewsCarouselRef.current
    if (!node) return
    const slide = node.children[activeReviewIndex]
    if (!slide) return
    node.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' })
  }, [activeReviewIndex])

  const handleReviewSubmit = async (event) => {
    event.preventDefault()
    if (reviewSubmitting) return
    const name = reviewForm.name.trim()
    const city = reviewForm.city.trim()
    const text = reviewForm.text.trim()
    const rating = Math.min(5, Math.max(1, Number(reviewForm.rating) || 5))

    if (name.length < 2) {
      setReviewError('Введите имя (минимум 2 символа).')
      setReviewSuccess('')
      return
    }
    if (text.length < 8) {
      setReviewError('Отзыв должен быть не короче 8 символов.')
      setReviewSuccess('')
      return
    }

    setReviewSubmitting(true)
    setReviewError('')
    setReviewSuccess('')

    const { data, error } = await supabase.functions.invoke('submit-review', {
      body: {
        name,
        city: city || null,
        rating,
        text,
      },
    })

    const duplicateIp = data?.error === 'duplicate_ip' || String(error?.message || '').toLowerCase().includes('duplicate_ip')
    if (duplicateIp) {
      setReviewError('С этого IP уже был отправлен отзыв. Разрешен только один отзыв.')
      setReviewSubmitting(false)
      return
    }

    if (error || !data?.review) {
      setReviewError('Не удалось отправить отзыв. Попробуйте позже.')
      setReviewSubmitting(false)
      return
    }

    setReviews((prev) => [normalizeReviewRow(data.review), ...prev])
    setReviewForm({ name: '', city: '', rating: 5, text: '' })
    setActiveReviewIndex(0)
    setReviewSuccess('Спасибо! Ваш отзыв добавлен.')
    setReviewSubmitting(false)
  }

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
          {loading ? <div className="ad-banner skeleton-box banner-skeleton" /> : null}
          {!loading && adBanners.length > 0 ? (
            <div className="ad-carousel-wrap">
              <div className="ad-carousel-scroll" ref={carouselRef}>
                {adBanners.map((url, index) => (
                  <a key={`${url}-${index}`} className="ad-banner ad-slide" href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt={`Рекламный баннер ${index + 1}`} />
                  </a>
                ))}
              </div>
              {adBanners.length > 1 ? (
                <div className="ad-dots">
                  {adBanners.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      className={index === activeBannerIndex ? 'ad-dot active' : 'ad-dot'}
                      onClick={() => setActiveBannerIndex(index)}
                      aria-label={`Баннер ${index + 1}`}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </header>

        <div className="chips">
          {loading
            ? [1, 2, 3, 4].map((item) => <div key={item} className="chip chip-skeleton skeleton-box" />)
            : categories.map((category) => (
                <button
                  key={category}
                  className={category === activeCategory ? 'chip active' : 'chip'}
                  onClick={() => setActiveCategory(category)}
                >
                  {categoryLabels[category] || category}
                </button>
              ))}
        </div>

        <section className="products-section">
          <div className="section-head">
            <h2>Доступные тарифы</h2>
          </div>

          {loading ? (
            <div className="products-list">
              {loadingCards.map((item) => (
                <article key={item} className="list-card">
                  <div className="list-card-main">
                    <div className="skeleton-col">
                      <div className="skeleton-box skeleton-text-xs" />
                      <div className="skeleton-box skeleton-text-lg" />
                      <div className="skeleton-box skeleton-text-sm" />
                    </div>
                    <div className="skeleton-col-right">
                      <div className="skeleton-box skeleton-text-md" />
                      <div className="skeleton-box skeleton-text-xs" />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="products-list">
              {filtered.map((item) => {
                const discount = getDiscount(item.old_price, item.price)
                const isOpen = openedProductId === item.id
                const providerKey = getProviderKey(item.provider)
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
                      {item.badge ? <p className="meta">{item.badge}</p> : null}
                      <h3>{item.title}</h3>
                      <p className="provider">
                        {providerKey ? (
                          <img
                            className="provider-logo-img"
                            src={providerLogos[providerKey]}
                            alt={item.provider || 'provider logo'}
                            loading="lazy"
                          />
                        ) : null}
                        <span>{item.provider || '—'}</span>
                      </p>
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
          )}

          {!loading && filtered.length === 0 ? <p className="empty">No products found. Add items in the admin panel.</p> : null}
        </section>

        <section className="why-us">
          <h2>Почему выбирают нас?</h2>
          {loading ? (
            <div className="why-us-list">
              {[1, 2, 3].map((item) => (
                <article key={item} className="why-card">
                  <div className="skeleton-box skeleton-text-lg" />
                  <div className="skeleton-box skeleton-text-sm" />
                </article>
              ))}
            </div>
          ) : (
            <div className="why-us-list">
              <article className="why-card">
                <h3>📱 Большой выбор номеров</h3>
                <p>Более 500 тысяч номеров в нашей базе</p>
              </article>
              <article className="why-card">
                <h3>🛡 Официальные SIM-карты</h3>
                <p>Все номера официальные и регистрируются на вас.</p>
              </article>
              <article className="why-card">
                <h3>💸 Выгодные тарифы</h3>
                <p>Подбираем самые выгодные предложения.</p>
              </article>
              <article className="why-card">
                <h3>💬 Поддержка в WhatsApp</h3>
                <p>Поможем с выбором номера, тарифом и подключением в любое время.</p>
              </article>
            </div>
          )}
        </section>

        <section className="faq-section">
          <h2>FAQ</h2>
          {loading ? (
            <div className="faq-list">
              {loadingFaq.map((item) => (
                <article key={item} className="faq-item">
                  <div className="faq-question">
                    <div className="skeleton-box skeleton-text-md" />
                    <div className="skeleton-box skeleton-circle" />
                  </div>
                </article>
              ))}
            </div>
          ) : (
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
          )}
        </section>

        <section className="reviews-section">
          <h2>Отзывы</h2>

          <form className="review-form" onSubmit={handleReviewSubmit}>
            <label>
              <span>Имя</span>
              <input
                type="text"
                value={reviewForm.name}
                onChange={(event) => setReviewForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Ваше имя"
                maxLength={40}
                required
              />
            </label>
            <label>
              <span>Город</span>
              <input
                type="text"
                value={reviewForm.city}
                onChange={(event) => setReviewForm((prev) => ({ ...prev, city: event.target.value }))}
                placeholder="Например, Москва"
                maxLength={40}
              />
            </label>
            <label>
              <span>Оценка</span>
              <div className="rating-picker" role="radiogroup" aria-label="Оценка">
                {[1, 2, 3, 4, 5].map((value) => {
                  const active = value <= reviewForm.rating
                  return (
                    <button
                      key={value}
                      type="button"
                      className={active ? 'rating-star active' : 'rating-star'}
                      onClick={() => setReviewForm((prev) => ({ ...prev, rating: value }))}
                      aria-label={`Поставить ${value} из 5`}
                      aria-pressed={active}
                    >
                      ★
                    </button>
                  )
                })}
              </div>
            </label>
            <label>
              <span>Отзыв</span>
              <textarea
                value={reviewForm.text}
                onChange={(event) => setReviewForm((prev) => ({ ...prev, text: event.target.value }))}
                placeholder="Расскажите о вашем опыте"
                rows={4}
                required
              />
            </label>
            <button className="review-btn" type="submit" disabled={reviewSubmitting}>
              {reviewSubmitting ? 'Отправка...' : 'Отправить отзыв'}
            </button>
            {reviewError ? <p className="review-status error">{reviewError}</p> : null}
            {reviewSuccess ? <p className="review-status success">{reviewSuccess}</p> : null}
          </form>

          <div className="reviews-carousel-wrap">
            <div className="reviews-carousel-scroll" ref={reviewsCarouselRef}>
              {reviews.map((review) => (
                <article key={review.id} className="review-card">
                  <div className="review-head">
                    <strong>{review.name}</strong>
                    <span>{review.city}</span>
                  </div>
                  <p className="review-rating" aria-label={`Оценка ${review.rating} из 5`}>
                    {'★'.repeat(review.rating)}
                    {'☆'.repeat(5 - review.rating)}
                  </p>
                  <p>{review.text}</p>
                </article>
              ))}
            </div>
            {reviews.length === 0 ? <p className="empty">Пока нет отзывов. Будьте первым.</p> : null}
            {reviews.length > 1 ? (
              <div className="review-dots">
                {reviews.map((review, index) => (
                  <button
                    key={review.id}
                    type="button"
                    className={index === activeReviewIndex ? 'review-dot active' : 'review-dot'}
                    onClick={() => setActiveReviewIndex(index)}
                    aria-label={`Отзыв ${index + 1}`}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  )
}
