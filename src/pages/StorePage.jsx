import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabaseClient'
import ru from '../i18n/ru'
import { RiHome9Fill, RiHome9Line, RiSimCardFill, RiSimCardLine, RiStarFill, RiStarLine } from 'react-icons/ri'

const categories = ['all', 'megafon', 'beeline', 'mts', 'yota']

const providerLogos = {
  megafon: '/provider-logos/megafon.png',
  beeline: '/provider-logos/beeline.png',
  mts: '/provider-logos/mts.png',
  yota: '/provider-logos/yota.png',
}

function formatPrice(value) {
  if (value == null) return ''
  return new Intl.NumberFormat('ru-RU').format(Number(value))
}

function getDiscount(oldPrice, price) {
  if (!oldPrice || !price || oldPrice <= price) return null
  return Math.round(((oldPrice - price) / oldPrice) * 100)
}

function getTrafficLabel(item, unlimitedLabel) {
  return item?.is_unlimited ? unlimitedLabel : `${item?.data_gb ?? '-'} GB`
}

function getMonthlyPayment(item, rubSign) {
  const amount = item?.monthly_payment ?? item?.price
  return amount != null ? `${formatPrice(amount)} ${rubSign}` : '-'
}

function getProviderKey(value) {
  const next = String(value || '').trim().toLowerCase()
  if (next.includes('megafon') || next.includes('мегафон')) return 'megafon'
  if (next.includes('beeline') || next.includes('билайн')) return 'beeline'
  if (next === 'mts' || next.includes('мтс')) return 'mts'
  if (next.includes('yota') || next.includes('йота')) return 'yota'
  return ''
}

function formatWhatsappLabel(value) {
  const digits = (value || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 11 && digits.startsWith('7')) {
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`
  }
  return `+${digits}`
}

export default function StorePage() {
  const t = ru
  const categoryLabels = t.tariffs.categories
  const faqItems = t.faq.items

  const [activePage, setActivePage] = useState('home')
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
      setReviewSubmitError(t.reviews.form.fillError)
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
      setReviewSubmitError(t.reviews.form.submitError)
      setReviewSubmitLoading(false)
      return
    }

    setReviewForm({ name: '', text: '', rating: '5' })
    setReviewSubmitLoading(false)
    fetchReviews()
  }

  useEffect(() => {
    let next = [...products]

    if (activeCategory !== 'all') {
      next = next.filter((item) => item.category === activeCategory)
    }

    if (search.trim()) {
      const query = search.toLowerCase()
      next = next.filter((item) => item.title?.toLowerCase().includes(query) || item.provider?.toLowerCase().includes(query))
    }

    setFiltered(next)
  }, [products, activeCategory, search])

  const appUrl = useMemo(() => {
    return import.meta.env.VITE_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')
  }, [])

  const averageReviewRating = useMemo(() => {
    if (!reviews.length) return null
    const total = reviews.reduce((sum, item) => sum + (Number(item.rating) || 0), 0)
    return (total / reviews.length).toFixed(1)
  }, [reviews])

  const connectedClientsCount = useMemo(() => {
    const totalFromProducts = products.reduce((sum, item) => sum + (Number(item.sales_count) || 0), 0)
    return totalFromProducts > 0 ? totalFromProducts : 5000
  }, [products])

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
    if (activePage !== 'tariffs') return
    const node = carouselRef.current
    if (!node) return
    const slide = node.children[activeBannerIndex]
    if (!slide) return
    node.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' })
  }, [activeBannerIndex, activePage])

  const goToPage = (page) => {
    setActivePage(page)
    setOpenedProductId(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (isDesktop) {
    return (
      <main className="desktop-gate">
        <div className="desktop-card">
          <h1>{t.desktop.title}</h1>
          <p>{t.desktop.subtitle}</p>
          {qrData ? <img src={qrData} alt="QR code" className="qr-code" /> : <div className="qr-skeleton" />}
          <p className="hint">{t.desktop.open} {appUrl}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="mobile-store">
      <section className="phone-shell with-bottom-nav">
        {activePage === 'home' ? (
          <>
            <header className="hero">
              <div className="title-row">
                <h1>{t.home.hero}</h1>
              </div>
            </header>

            <section className="about-section">
              <h2>{t.home.aboutTitle}</h2>
              <p>{t.home.aboutText}</p>
            </section>

            <section className="clients-stat-section">
              <p className="clients-stat-value">{formatPrice(connectedClientsCount)}+</p>
              <p className="clients-stat-label">{t.home.clientsLabel}</p>
            </section>

            <section className="why-us">
              <h2>{t.home.whyTitle}</h2>
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
                  {t.home.features.map((feature) => (
                    <article key={feature.title} className="why-card">
                      <h3>{feature.title}</h3>
                      <p>{feature.text}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="faq-section">
              <h2>{t.faq.title}</h2>
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
                          <span>{isOpen ? '-' : '+'}</span>
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
          </>
        ) : null}

        {activePage === 'tariffs' ? (
          <>
            <header className="hero">
              <div className="title-row">
                <h1>{t.tariffs.title}</h1>
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
                    placeholder={t.tariffs.searchPlaceholder}
                  />
                </div>
              </div>

              {loading ? <div className="ad-banner skeleton-box banner-skeleton" /> : null}
              {!loading && adBanners.length > 0 ? (
                <div className="ad-carousel-wrap">
                  <div className="ad-carousel-scroll" ref={carouselRef}>
                    {adBanners.map((url, index) => (
                      <a key={`${url}-${index}`} className="ad-banner ad-slide" href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt={`${t.tariffs.bannerAlt} ${index + 1}`} />
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
                          aria-label={`${t.tariffs.bannerAria} ${index + 1}`}
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
                <h2>{t.tariffs.listTitle}</h2>
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
                      <article key={item.id} className={isOpen ? 'list-card open' : 'list-card'}>
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
                              <span>{item.provider || '-'}</span>
                            </p>
                          </div>
                          <div className="list-price-col">
                            <strong>{item.price != null ? `${formatPrice(item.price)} ${t.common.rub}` : '-'}</strong>
                            {item.old_price ? <span className="old-price">{formatPrice(item.old_price)} {t.common.rub}</span> : null}
                            {discount ? <span className="discount">{discount}% {t.tariffs.discount}</span> : null}
                            <span className="list-toggle">{isOpen ? t.tariffs.collapse : t.tariffs.details}</span>
                          </div>
                        </button>
                        <div className={isOpen ? 'list-card-details open' : 'list-card-details'}>
                          <div className="details-inner">
                            <p className="modal-row"><span>{t.tariffs.traffic}</span><strong>{getTrafficLabel(item, t.tariffs.unlimited)}</strong></p>
                            <p className="modal-row"><span>{t.tariffs.minutes}</span><strong>{item.minutes ?? 0}</strong></p>
                            <p className="modal-row"><span>{t.tariffs.sms}</span><strong>{item.sms ?? 0}</strong></p>
                            <p className="modal-row"><span>{t.tariffs.monthlyPayment}</span><strong>{getMonthlyPayment(item, t.common.rub)}</strong></p>
                            {item.badge ? <p className="modal-row"><span>{t.tariffs.badge}</span><strong>{item.badge}</strong></p> : null}
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}

              {!loading && filtered.length === 0 ? <p className="empty">{t.tariffs.noResults}</p> : null}
            </section>
          </>
        ) : null}

        {activePage === 'reviews' ? (
          <section className="reviews-section" aria-label={t.reviews.sectionAria}>
            <div className="reviews-head">
              <div className="reviews-title-wrap">
                <h2>{t.reviews.title}</h2>
                {averageReviewRating ? (
                  <span className="reviews-average-rating" aria-label={`${t.reviews.averageAriaPrefix} ${averageReviewRating} ${t.reviews.averageAriaSuffix}`}>
                    &#9733; {averageReviewRating}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="review-inline-form-card">
              <h3>{t.reviews.form.title}</h3>
              <form className="review-form review-inline-form" onSubmit={submitReview}>
                <input
                  type="text"
                  placeholder={t.reviews.form.namePlaceholder}
                  value={reviewForm.name}
                  onChange={(event) => setReviewForm((prev) => ({ ...prev, name: event.target.value }))}
                  maxLength={70}
                  required
                />
                <textarea
                  placeholder={t.reviews.form.textPlaceholder}
                  value={reviewForm.text}
                  onChange={(event) => setReviewForm((prev) => ({ ...prev, text: event.target.value }))}
                  maxLength={500}
                  required
                />
                <div className="review-stars-wrap">
                  <span>{t.reviews.form.rating}</span>
                  <div className="review-stars" role="radiogroup" aria-label={t.reviews.form.ratingAria}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        role="radio"
                        aria-checked={Number(reviewForm.rating) === star}
                        aria-label={`${t.reviews.form.ratingOption} ${star}`}
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
                  <button type="submit" disabled={reviewSubmitLoading}>
                    {reviewSubmitLoading ? t.reviews.form.submitting : t.reviews.form.submit}
                  </button>
                </div>
              </form>
            </div>

            {reviewsLoading ? (
              <div className="reviews-list">
                {loadingReviews.map((item) => (
                  <article key={item} className="review-card review-card-full">
                    <div className="skeleton-box skeleton-text-sm" />
                    <div className="skeleton-box skeleton-text-lg" />
                    <div className="skeleton-box skeleton-text-sm" />
                  </article>
                ))}
              </div>
            ) : reviews.length > 0 ? (
              <div className="reviews-list">
                {reviews.map((item) => (
                  <article key={item.id || item.name} className="review-card review-card-full">
                    <div className="review-card-head">
                      <p className="review-name">{item.name}</p>
                      <p className="review-rating">{'★'.repeat(Math.min(5, Math.max(0, Math.round(Number(item.rating) || 0))))}</p>
                    </div>
                    <p className="review-text">{item.text}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty">{t.reviews.empty}</p>
            )}
          </section>
        ) : null}

        <nav className="bottom-nav" aria-label={t.nav.aria}>
          <button type="button" className={activePage === 'home' ? 'bottom-nav-item active' : 'bottom-nav-item'} onClick={() => goToPage('home')}>
            {activePage === 'home' ? <RiHome9Fill className="bottom-nav-icon" aria-hidden="true" /> : <RiHome9Line className="bottom-nav-icon" aria-hidden="true" />}
            <span>{t.nav.home}</span>
          </button>
          <button type="button" className={activePage === 'tariffs' ? 'bottom-nav-item active' : 'bottom-nav-item'} onClick={() => goToPage('tariffs')}>
            {activePage === 'tariffs' ? <RiSimCardFill className="bottom-nav-icon" aria-hidden="true" /> : <RiSimCardLine className="bottom-nav-icon" aria-hidden="true" />}
            <span>{t.nav.tariffs}</span>
          </button>
          <button type="button" className={activePage === 'reviews' ? 'bottom-nav-item active' : 'bottom-nav-item'} onClick={() => goToPage('reviews')}>
            {activePage === 'reviews' ? <RiStarFill className="bottom-nav-icon" aria-hidden="true" /> : <RiStarLine className="bottom-nav-icon" aria-hidden="true" />}
            <span>{t.nav.reviews}</span>
          </button>
          <a className="bottom-nav-item" href={whatsappHref} target="_blank" rel="noreferrer">
            <span className="bottom-nav-icon whatsapp-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="presentation">
                <path d="M20.52 3.48A11.82 11.82 0 0 0 12.03 0C5.42 0 .03 5.39.03 12c0 2.12.56 4.2 1.61 6.03L0 24l6.16-1.6A11.96 11.96 0 0 0 12.03 24c6.6 0 11.97-5.39 11.97-12 0-3.2-1.24-6.21-3.48-8.52Zm-8.49 18.5c-1.81 0-3.59-.49-5.14-1.41l-.37-.22-3.66.95.98-3.57-.24-.37A9.9 9.9 0 0 1 2.03 12c0-5.51 4.48-10 10-10 2.67 0 5.19 1.04 7.07 2.93A9.92 9.92 0 0 1 22.03 12c0 5.52-4.48 10-10 10Zm5.49-7.49c-.3-.15-1.76-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.49-.9-.8-1.5-1.79-1.68-2.09-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49 0 1.47 1.07 2.89 1.22 3.09.15.2 2.1 3.2 5.09 4.48.71.31 1.27.49 1.7.63.72.23 1.38.2 1.9.12.58-.09 1.76-.72 2.01-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z" />
              </svg>
            </span>
            <span>{t.nav.whatsapp}</span>
          </a>
        </nav>
      </section>
    </main>
  )
}








