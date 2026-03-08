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
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [reviewSubmitLoading, setReviewSubmitLoading] = useState(false)
  const [reviewSubmitError, setReviewSubmitError] = useState('')
  const [reviewForm, setReviewForm] = useState({ name: '', text: '', rating: '5' })
  const [loading, setLoading] = useState(true)
  const [qrData, setQrData] = useState('')
  const carouselRef = useRef(null)
  const whatsappNumber = '79280013099'
  const whatsappLabel = formatWhatsappLabel(whatsappNumber)
  const whatsappHref = `https://wa.me/${whatsappNumber.replace(/\D/g, '')}`
  const loadingCards = [1, 2, 3, 4]
  const loadingFaq = [1, 2, 3]
  const loadingReviews = [1, 2, 3]

  const fetchReviews = async () => {
    setReviewsLoading(true)
    const { data, error } = await supabase
      .from('reviews')
      .select('id, name, text, rating, created_at')
      .eq('is_approved', true)
      .order('created_at', { ascending: false })
      .limit(12)

    if (error) {
      console.error(error)
      setReviews([])
    } else {
      setReviews(data || [])
    }

    setReviewsLoading(false)
  }

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
        .select('ad_image_url, ad_banners')
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
      setLoading(false)
    }

    fetchStoreData()
    fetchReviews()
  }, [])
  const submitReview = async (event) => {
    event.preventDefault()
    if (reviewSubmitLoading) return

    const nextName = reviewForm.name.trim()
    const nextText = reviewForm.text.trim()
    const rawRating = Number(reviewForm.rating)
    const nextRating = Math.min(5, Math.max(1, Number.isFinite(rawRating) ? Math.round(rawRating) : 5))

    if (!nextName || !nextText) {
      setReviewSubmitError('Заполните имя и текст отзыва.')
      return
    }

    setReviewSubmitLoading(true)
    setReviewSubmitError('')

    const { error } = await supabase.from('reviews').insert({
      name: nextName,
      text: nextText,
      rating: nextRating,
      is_approved: true,
    })

    if (error) {
      console.error(error)
      setReviewSubmitError('Не удалось отправить отзыв. Попробуйте еще раз.')
      setReviewSubmitLoading(false)
      return
    }

    setReviewForm({ name: '', text: '', rating: '5' })
    setReviewSubmitLoading(false)
    setReviewModalOpen(false)
    fetchReviews()
  }

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
        <section className="reviews-section" aria-label="Отзывы клиентов">
          <div className="reviews-head">
            <h2>Отзывы</h2>
            <button type="button" className="review-write-btn" onClick={() => setReviewModalOpen(true)}>
              Написать отзыв
            </button>
          </div>
          {reviewsLoading ? (
            <div className="reviews-list">
              {loadingReviews.map((item) => (
                <article key={item} className="review-card">
                  <div className="skeleton-box skeleton-text-sm" />
                  <div className="skeleton-box skeleton-text-lg" />
                  <div className="skeleton-box skeleton-text-sm" />
                </article>
              ))}
            </div>
          ) : reviews.length > 0 ? (
            <div className="reviews-carousel">
              <div className={reviews.length > 1 ? 'reviews-track animate' : 'reviews-track'}>
                {(reviews.length > 1 ? [...reviews, ...reviews] : reviews).map((item, index) => (
                  <article key={`${item.id || item.name}-${index}`} className="review-card">
                    <p className="review-rating">&#9733; {Math.round(Number(item.rating) || 0)}</p>
                    <p className="review-text">{item.text}</p>
                    <p className="review-name">{item.name}</p>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <p className="empty">Пока нет отзывов. Будьте первым.</p>
          )}
        </section>

        {reviewModalOpen ? (
          <div className="review-modal-backdrop" onClick={() => setReviewModalOpen(false)}>
            <div className="review-modal" onClick={(event) => event.stopPropagation()}>
              <h3>Написать отзыв</h3>
              <form className="review-form" onSubmit={submitReview}>
                <input
                  type="text"
                  placeholder="Ваше имя"
                  value={reviewForm.name}
                  onChange={(event) => setReviewForm((prev) => ({ ...prev, name: event.target.value }))}
                  maxLength={70}
                  required
                />
                <textarea
                  placeholder="Ваш отзыв"
                  value={reviewForm.text}
                  onChange={(event) => setReviewForm((prev) => ({ ...prev, text: event.target.value }))}
                  maxLength={500}
                  required
                />
                <div className="review-stars-wrap">
                  <span>Оценка</span>
                  <div className="review-stars" role="radiogroup" aria-label="Оценка">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        role="radio"
                        aria-checked={Number(reviewForm.rating) === star}
                        aria-label={`Оценка ${star}`}
                        className={Number(reviewForm.rating) >= star ? 'review-star active' : 'review-star'}
                        onClick={() => setReviewForm((prev) => ({ ...prev, rating: String(star) }))}
                      >
                        &#9733;
                      </button>
                    ))}
                  </div>
                </div>
                {reviewSubmitError ? <p className="review-form-error">{reviewSubmitError}</p> : null}
                <div className="review-form-actions">
                  <button type="button" className="secondary" onClick={() => setReviewModalOpen(false)}>
                    Отмена
                  </button>
                  <button type="submit" disabled={reviewSubmitLoading}>
                    {reviewSubmitLoading ? 'Отправка...' : 'Отправить'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  )
}
