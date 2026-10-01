
(function preseedBookingLinks() {
  const defaultBooking = 'https://www.fresha.com/a/hairvalley-hurstville-shop-435-park-rd-hurstville-nsw-2220-vyp5k3fg/all-offer?menu=true&pId=2626895';
  function applyLinks() {
    document.querySelectorAll('a.btn-glass, a.dock-btn-cta, a.btn-editorial-book').forEach(el => {
      if (!el.href || el.href.includes('#') || el.textContent.includes('Book')) {
        el.href = defaultBooking;
        el.target = '_blank';
        el.rel = 'noopener noreferrer';
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyLinks);
  } else {
    applyLinks();
  }
})();


/**
 * Hair Valley — Interactive Orchestration
 * Follows the design blueprint: motion is spent once on the hero load,
 * everywhere else motion only responds to user interaction.
 */

document.addEventListener('DOMContentLoaded', () => {
  initHeroEntrance();
  initStickyHeader();
  initMobileMenu();
  initNewsletterForm();
  initReviewsSlider();
  initContactForm();
  hydrateLiveContent();
});

/**
 * 1. Hero Entrance Animation:
 * Intro card rises 12px and fades in 400ms AFTER background image has settled.
 */
function initHeroEntrance() {
  const heroEditorial = document.querySelector('.hero-direct-editorial');
  const heroDock = document.querySelector('.hero-crystal-dock');
  const heroConsole = document.querySelector('.hero-glass-console');

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  if (heroEditorial) {
    heroEditorial.style.opacity = '0';
    heroEditorial.style.transform = 'translateY(10px)';
    heroEditorial.style.transition = 'opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
    setTimeout(() => {
      heroEditorial.style.opacity = '1';
      heroEditorial.style.transform = 'translateY(0)';
    }, 250);
  }

  if (heroDock) {
    heroDock.style.opacity = '0';
    heroDock.style.transform = 'translateY(12px)';
    heroDock.style.transition = 'opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.15s, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.15s';
    setTimeout(() => {
      heroDock.style.opacity = '1';
      heroDock.style.transform = 'translateY(0)';
    }, 350);
  }

  if (heroConsole && window.innerWidth > 980) {
    heroConsole.style.opacity = '0';
    heroConsole.style.transform = 'translate(-50%, 12px)';
    heroConsole.style.transition = 'opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)';
    setTimeout(() => {
      heroConsole.style.opacity = '1';
      heroConsole.style.transform = 'translate(-50%, 0)';
    }, 300);
  }
}

/**
 * 2. Sticky Header scroll observer
 */
function initStickyHeader() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  const handleScroll = () => {
    if (window.scrollY > 15) {
      header.classList.add('is-scrolled');
    } else {
      header.classList.remove('is-scrolled');
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();
}

/**
 * 3. Mobile Navigation Drawer
 */
function initMobileMenu() {
  const toggle = document.querySelector('.mobile-nav-toggle');
  const drawer = document.querySelector('.mobile-nav-drawer');
  if (!toggle || !drawer) return;

  toggle.addEventListener('click', () => {
    const isOpen = drawer.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  // Close when clicking a nav link
  drawer.querySelectorAll('.nav-link, .btn-glass').forEach(link => {
    link.addEventListener('click', () => {
      drawer.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', false);
      document.body.style.overflow = '';
    });
  });
}

/**
 * 4. Newsletter visual submission confirmation
 */
function initNewsletterForm() {
  const forms = document.querySelectorAll('.glass-newsletter-form');
  forms.forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input');
      const btn = form.querySelector('button');
      if (input && input.value) {
        btn.textContent = 'Subscribed';
        btn.style.backgroundColor = 'var(--espresso)';
        input.value = '';
        setTimeout(() => {
          btn.textContent = 'Subscribe';
          btn.style.backgroundColor = '';
        }, 3000);
      }
    });
  });
}

/**
 * 5. Dynamic Live Content Hydration (Synchronized with Admin CMS)
 */
async function hydrateLiveContent() {
  try {
    const res = await fetch('/api/content');
    if (!res.ok) return;
    const data = await res.json();

    const bookingUrl = (data.contact && data.contact.bookingUrl) || 'https://www.fresha.com/a/hairvalley-hurstville-shop-435-park-rd-hurstville-nsw-2220-vyp5k3fg/all-offer?menu=true&pId=2626895';

    // Synchronize all Book Appointment buttons across the page
    document.querySelectorAll('a.btn-glass, a.dock-btn-cta, a.btn-editorial-book').forEach(el => {
      if (el.textContent.includes('Book Appointment')) {
        el.href = bookingUrl;
        el.target = '_blank';
        el.rel = 'noopener noreferrer';
      }
    });

    // 1. Index Page Hydration
    if (document.querySelector('.hero-cinematic-stage')) {
      if (data.hero) {
        if (data.hero.backgroundImage) {
          document.querySelectorAll('.hero-layer-base img').forEach(img => {
            img.src = data.hero.backgroundImage;
          });
        }
        if (data.hero.quote) {
          const quoteEl = document.querySelector('.hero-editorial-quote');
          if (quoteEl) quoteEl.textContent = data.hero.quote;
        }
        if (data.hero.title) {
          const titleEl = document.querySelector('.hero-direct-title');
          if (titleEl) {
            const commaIdx = data.hero.title.indexOf(',');
            if (commaIdx > -1 && commaIdx < data.hero.title.length - 1) {
              titleEl.textContent = '';
              titleEl.appendChild(document.createTextNode(data.hero.title.slice(0, commaIdx + 1)));
              titleEl.appendChild(document.createElement('br'));
              const accent = document.createElement('span');
              accent.className = 'title-italic-accent';
              accent.textContent = data.hero.title.slice(commaIdx + 1).trim();
              titleEl.appendChild(accent);
            } else {
              titleEl.textContent = data.hero.title;
            }
          }
        }
        if (data.hero.eyebrow) {
          const eyebrowEl = document.querySelector('.hero-content-overlay .eyebrow');
          if (eyebrowEl) eyebrowEl.textContent = data.hero.eyebrow;
        }
      }
      if (data.atelier) {
        if (data.atelier.archModelImage) {
          const archImg = document.querySelector('.hero-arch-portal img');
          if (archImg) archImg.src = data.atelier.archModelImage;
        }
        if (data.atelier.quote) {
          const archQuote = document.querySelector('.hero-manifesto-quote');
          if (archQuote) archQuote.textContent = `“${data.atelier.quote.replace(/^“|”$/g, '')}”`;
        }
        if (data.atelier.eyebrow) {
          const mastEyebrow = document.querySelector('.hero-masthead .eyebrow');
          if (mastEyebrow) mastEyebrow.textContent = data.atelier.eyebrow;
        }
        if (data.atelier.title) {
          const mastTitle = document.querySelector('.hero-masthead .display-section');
          if (mastTitle) mastTitle.textContent = data.atelier.title;
        }
        if (data.atelier.subtitle) {
          const mastSubtitle = document.querySelector('.hero-masthead .body-text');
          if (mastSubtitle) mastSubtitle.textContent = data.atelier.subtitle;
        }
      }
    }

    // 1b. Homepage Featured Services Spread Hydration
    if (document.querySelector('.editorial-featured-spread') && Array.isArray(data.services)) {
      hydrateFeaturedServices(data.services, bookingUrl);
    }

    // 2. Services Page Hydration
    if (document.getElementById('servicesGrid') && Array.isArray(data.services)) {
      hydrateServicesPage(data.services, bookingUrl);
    }

    // 3. About Page Hydration
    if (document.querySelector('.about-hero-viewport') && data.about) {
      if (data.about.heroImage) {
        const aboutHeroImg = document.querySelector('.about-hero-viewport img');
        if (aboutHeroImg) aboutHeroImg.src = data.about.heroImage;
      }
      if (data.about.pullQuote) {
        const pullQuoteEl = document.querySelector('.about-pullquote-title');
        if (pullQuoteEl) pullQuoteEl.textContent = data.about.pullQuote;
      }
      hydrateAboutPage(data.about);
    }

    // 4. Salon Location & Trading Hours Hydration
    if (data.contact) {
      hydrateLocationInfo(data.contact, data.branches);
    }

    // 5. Google Reviews Hydration
    const reviewsTrack = document.getElementById('reviewsTrack');
    if (reviewsTrack && data.googleReviews && data.googleReviews.length) {
      hydrateReviewsTrack(reviewsTrack, data.googleReviews, data.googleReviewsUrl);
    }
    const badgeLink = document.getElementById('googleReviewsBadgeLink');
    if (badgeLink && data.googleReviewsUrl) {
      badgeLink.href = data.googleReviewsUrl;
    }
  } catch (e) {
    // Non-blocking fallback to static HTML
  }
}

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * 5a. About Page Hydration (Admin "Stylists & Rituals" tab)
 * Renders data.about.rituals into the ritual timeline nodes and
 * data.about.stylists into the magazine spread (lead + companions).
 */
function hydrateAboutPage(about) {
  // --- Rituals: patch existing .ritual-node cards by index ---
  const track = document.querySelector('.ritual-timeline-track');
  const rituals = Array.isArray(about.rituals) ? about.rituals : [];
  if (track && rituals.length) {
    let nodes = Array.from(track.querySelectorAll('.ritual-node'));

    // Clone extra nodes if more rituals than existing slots
    while (nodes.length < rituals.length && nodes.length) {
      const clone = nodes[0].cloneNode(true);
      nodes[nodes.length - 1].after(clone);
      nodes.push(clone);
    }
    // Remove surplus nodes if fewer rituals than slots
    while (nodes.length > rituals.length) {
      nodes.pop().remove();
    }

    rituals.forEach((r, i) => {
      const node = nodes[i];
      if (!node) return;
      const img = node.querySelector('.ritual-photo-frame img');
      const movement = node.querySelector('.ritual-card-drop .caption');
      const name = node.querySelector('.ritual-card-drop .heading-card');
      const desc = node.querySelector('.ritual-card-drop .body-sm');
      const chip = node.querySelector('.ritual-card-drop .chip-title');
      if (img && r.image) { img.src = r.image; img.alt = r.name || 'Salon ritual'; }
      if (movement && r.movement) movement.textContent = r.movement;
      if (name && r.name) name.textContent = r.name;
      if (desc && r.description) desc.textContent = r.description;
      if (chip && r.duration) chip.textContent = r.duration;
    });
  }

  // --- Stylists: lead card = stylists[0], rest = companion items ---
  const stylists = Array.isArray(about.stylists) ? about.stylists : [];
  if (!stylists.length) return;

  const leadCard = document.querySelector('.stylist-lead-card');
  const lead = stylists[0];
  if (leadCard && lead) {
    const img = leadCard.querySelector('.stylist-lead-thumb img');
    const tag = leadCard.querySelector('.eyebrow--rose');
    const captions = leadCard.querySelectorAll(':scope > .caption, :scope > div > .caption');
    const name = leadCard.querySelector('.heading-card');
    const bio = leadCard.querySelector('.body-text');
    if (img && lead.image) { img.src = lead.image; img.alt = lead.name || 'Stylist'; }
    if (tag && lead.tag) tag.textContent = lead.tag;
    if (captions[0] && lead.craftYears) captions[0].textContent = lead.craftYears;
    if (captions[1] && lead.role) captions[1].textContent = lead.role;
    if (name && lead.name) name.textContent = lead.name;
    if (bio && lead.bio) bio.textContent = lead.bio;
  }

  const stack = document.querySelector('.stylist-companions-stack');
  if (stack) {
    stack.innerHTML = stylists.slice(1).map(st => `
      <div class="stylist-companion-item">
        <div class="stylist-companion-thumb">
          <img src="${esc(st.image || 'images/stylist-2.jpg')}" alt="${esc(st.name || 'Stylist')}" loading="lazy">
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
          <span class="caption" style="color: var(--dusty-rose); font-weight: 500;">${esc(st.tag)}</span>
          <h4 class="heading-card" style="font-size: 1.25rem;">${esc(st.name)}</h4>
          <span class="caption" style="color: var(--espresso); font-weight: 500;">${esc(st.role)}</span>
          <p class="caption" style="line-height: 1.4; margin-top: 0.2rem;">${esc(st.bio)}</p>
        </div>
      </div>
    `).join('');
  }
}

/**
 * 5b. Salon Location & Trading Hours Hydration (Admin "Contact & Hours" tab)
 * Elements tagged with data-field attributes are populated from
 * contact.hurstville / contact.hours managed in the admin panel.
 */
function hydrateLocationInfo(contact, branches) {
  const flagship = contact.hurstville || {};
  const flagshipBranch = Array.isArray(branches)
    ? (branches.find(b => b.id === 'hurstville') || {})
    : {};

  document.querySelectorAll('[data-field="branch-name"]').forEach(el => {
    if (flagship.name) el.textContent = flagship.name;
  });

  document.querySelectorAll('[data-field="branch-address"]').forEach(el => {
    if (!flagship.address) return;
    const mapsLink = el.querySelector('.btn-directions-link');
    el.textContent = '';
    el.appendChild(document.createTextNode(flagship.address));
    if (flagship.landmark) {
      el.appendChild(document.createElement('br'));
      el.appendChild(document.createTextNode(flagship.landmark));
    }
    if (mapsLink) {
      el.appendChild(document.createElement('br'));
      if (flagshipBranch.mapsUrl) mapsLink.href = flagshipBranch.mapsUrl;
      el.appendChild(mapsLink);
    }
  });

  document.querySelectorAll('[data-field="branch-phone"]').forEach(el => {
    if (!flagship.phone) return;
    el.textContent = flagship.phone;
    if (el.tagName === 'A') el.href = `tel:${flagship.phone.replace(/[^0-9+]/g, '')}`;
  });

  document.querySelectorAll('[data-field="branch-email"]').forEach(el => {
    if (!flagship.email) return;
    el.textContent = flagship.email;
    if (el.tagName === 'A') el.href = `mailto:${flagship.email}`;
  });

  // Second studio (Leppington) — contact.leppington
  const studio = contact.leppington || {};
  const studioDigits = (studio.sms || '').replace(/[^0-9+]/g, '');
  document.querySelectorAll('[data-field="branch2-name"]').forEach(el => {
    if (studio.name) el.textContent = studio.name;
  });
  document.querySelectorAll('[data-field="branch2-policy"]').forEach(el => {
    if (studio.instructions) el.textContent = studio.instructions;
  });
  document.querySelectorAll('[data-field="branch2-sms"]').forEach(el => {
    if (!studio.sms) return;
    el.textContent = studio.sms;
    if (el.tagName === 'A') el.href = `sms:${studioDigits}`;
  });
  document.querySelectorAll('[data-field="branch2-sms-call"]').forEach(el => {
    if (studioDigits && el.tagName === 'A') el.href = `tel:${studioDigits}`;
  });
  document.querySelectorAll('[data-field="branch2-email"]').forEach(el => {
    if (!studio.email) return;
    el.textContent = studio.email;
    if (el.tagName === 'A') el.href = `mailto:${studio.email}`;
  });

  // Booking deposit policy text
  document.querySelectorAll('[data-field="booking-deposit"]').forEach(el => {
    if (contact.bookingDeposit) el.textContent = contact.bookingDeposit;
  });

  if (contact.hours) {
    const timePart = str => {
      const s = (str || '').trim();
      const idx = s.indexOf(':');
      if (idx === -1) return s;
      // Only strip a leading day label ("Thursday: 9:30 am" → "9:30 am");
      // a bare time like "9:30 am – 6:00 pm" has a digit before the colon.
      return /\d/.test(s.slice(0, idx)) ? s : s.slice(idx + 1).trim();
    };
    const standard = contact.hours.standard ? timePart(contact.hours.standard) : '';
    const thursday = contact.hours.thursday ? timePart(contact.hours.thursday) : '';
    const sunday = contact.hours.sunday ? timePart(contact.hours.sunday) : '';

    document.querySelectorAll('.hours-schedule-row').forEach(row => {
      const dayEl = row.querySelector('.hours-day');
      const timeEl = row.querySelector('.hours-time');
      if (!dayEl || !timeEl) return;
      const day = dayEl.textContent;
      if (/thu/i.test(day) && thursday) {
        timeEl.textContent = thursday;
      } else if (/sun/i.test(day) && sunday) {
        timeEl.textContent = sunday;
      } else if (standard) {
        timeEl.textContent = standard;
      }
    });
  }
}

/**
 * 6. Google Reviews Slider Navigation
 */
function initReviewsSlider() {
  const track = document.getElementById('reviewsTrack');
  const prevBtn = document.getElementById('btnPrevReview');
  const nextBtn = document.getElementById('btnNextReview');

  if (!track || !prevBtn || !nextBtn) return;

  function getStepWidth() {
    const card = track.querySelector('.review-card');
    if (!card) return 290;
    const style = window.getComputedStyle(track);
    const gap = parseFloat(style.gap) || parseFloat(style.columnGap) || 18;
    return card.offsetWidth + gap;
  }

  prevBtn.addEventListener('click', () => {
    const step = getStepWidth();
    track.scrollBy({ left: -step, behavior: 'smooth' });
  });

  nextBtn.addEventListener('click', () => {
    const step = getStepWidth();
    track.scrollBy({ left: step, behavior: 'smooth' });
  });
}

function hydrateReviewsTrack(track, reviews, fallbackUrl) {
  const defaultReviewUrl = fallbackUrl || 'https://www.google.com/search?q=hairvalley#lrd=0x6b12b9bd54b2f7d5:0x43db3c39bbc456b0,1,,,,';
  const googleIconSvg = `<svg class="review-google-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/><path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/></svg>`;

  track.innerHTML = reviews.map(r => {
    const rawLink = r.link && !r.link.includes('share.google') ? r.link : defaultReviewUrl;
    return `
    <div class="review-card">
      <div class="review-card-header">
        <div class="review-author-info">
          <div class="review-avatar-wrap">
            ${r.avatar ? `<img src="${r.avatar}" alt="${r.author}" class="review-avatar-img" onerror="this.style.display='none'; this.parentElement.textContent='${r.initials || r.author.charAt(0)}';">` : (r.initials || r.author.charAt(0))}
          </div>
          <div>
            <div class="review-author-name">${r.author}</div>
            <div class="review-author-badge">${r.badge || 'Verified Client'}</div>
          </div>
        </div>
        ${googleIconSvg}
      </div>
      <div class="review-rating-bar">
        <span class="reviews-stars-gold">${'★'.repeat(r.rating || 5)}</span>
      </div>
      <p class="review-body-text">
        “${r.text.replace(/^“|”$/g, '')}”
      </p>
      <div class="review-card-footer">
        <span class="review-date">${r.date || 'Google Verified'}</span>
        <a href="${rawLink}" target="_blank" rel="noopener noreferrer" class="btn-review-link">
          <span>View on Google</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </a>
      </div>
    </div>
  `;
  }).join('');
}

/**
 * 6b. Homepage Featured Services Spread Hydration
 * Synchronizes the 4 editorial feature cards on index.html with Admin CMS
 */
function hydrateFeaturedServices(services, bookingUrl = 'https://www.fresha.com/a/hairvalley-hurstville-shop-435-park-rd-hurstville-nsw-2220-vyp5k3fg/all-offer?menu=true&pId=2626895') {
  const spread = document.querySelector('.editorial-featured-spread');
  if (!spread || !Array.isArray(services) || !services.length) return;

  const bUrl = bookingUrl || 'https://www.fresha.com/a/hairvalley-hurstville-shop-435-park-rd-hurstville-nsw-2220-vyp5k3fg/all-offer?menu=true&pId=2626895';

  // 1. Hero Card: Category 01 · Haircuts
  const heroCard = spread.querySelector('.featured-hero-card') || spread.querySelector('[data-featured-cat="haircuts"]');
  const haircutService = services.find(s => s.category === 'haircuts' && s.featured) ||
                         services.find(s => s.category === 'haircuts') ||
                         services.find(s => s.id === 'srv-1');

  if (heroCard && haircutService) {
    const img = heroCard.querySelector('.card-img-thumb img');
    if (img && haircutService.image) {
      img.src = haircutService.image;
      img.alt = haircutService.name || 'Featured Haircut Service';
    }
    const title = heroCard.querySelector('.heading-card');
    if (title && haircutService.name) {
      title.textContent = haircutService.name;
    }
    const desc = heroCard.querySelector('.body-text');
    if (desc && haircutService.description) {
      desc.textContent = haircutService.description;
    }

    // Optional Price display
    const headerRow = heroCard.querySelector('.card-img-thumb + div') || heroCard.querySelector('div[style*="margin-bottom"]');
    if (headerRow) {
      let priceSpan = headerRow.querySelector('.hero-featured-price');
      if (haircutService.price && haircutService.price.trim()) {
        if (!priceSpan) {
          priceSpan = document.createElement('span');
          priceSpan.className = 'caption hero-featured-price';
          priceSpan.style.cssText = 'color: var(--espresso); font-weight: 600; font-size: 1.15rem;';
          headerRow.style.display = 'flex';
          headerRow.style.alignItems = 'center';
          headerRow.style.justifyContent = 'space-between';
          headerRow.appendChild(priceSpan);
        }
        priceSpan.textContent = haircutService.price.trim();
        priceSpan.style.display = '';
      } else if (priceSpan) {
        priceSpan.remove();
        headerRow.style.display = '';
      }
    }

    const bookBtn = heroCard.querySelector('a.btn-glass');
    if (bookBtn) {
      bookBtn.href = bUrl;
    }
  }

  // 2. Stacked Companion Cards: Categories 02, 03, 04
  const companionCats = [
    { key: 'blowwave', defaultId: 'srv-11' },
    { key: 'color', defaultId: 'srv-18' },
    { key: 'foils', defaultId: 'srv-26' }
  ];

  companionCats.forEach(({ key, defaultId }) => {
    const card = spread.querySelector(`.companion-card[data-featured-cat="${key}"]`);
    if (!card) return;

    const srv = services.find(s => s.category === key && s.featured) ||
                services.find(s => s.category === key) ||
                services.find(s => s.id === defaultId);
    if (!srv) return;

    const img = card.querySelector('.companion-img-thumb img');
    if (img && srv.image) {
      img.src = srv.image;
      img.alt = srv.name || 'Featured Service';
    }
    const title = card.querySelector('.heading-card');
    if (title && srv.name) {
      title.textContent = srv.name;
    }
    const desc = card.querySelector('.companion-content p.caption');
    if (desc && srv.description) {
      desc.textContent = srv.description;
    }

    // Optional Price display
    const actionWrap = card.querySelector('.companion-action');
    if (actionWrap) {
      let priceSpan = actionWrap.querySelector('.companion-price');
      if (srv.price && srv.price.trim()) {
        if (!priceSpan) {
          priceSpan = document.createElement('span');
          priceSpan.className = 'companion-price';
          actionWrap.insertBefore(priceSpan, actionWrap.firstChild);
        }
        priceSpan.textContent = srv.price.trim();
      } else if (priceSpan) {
        priceSpan.remove();
      }

      const bookBtn = actionWrap.querySelector('.companion-book-btn');
      if (bookBtn) {
        bookBtn.href = bUrl;
      }
    }
  });
}

function hydrateServicesPage(services, bookingUrl = 'https://www.fresha.com/a/hairvalley-hurstville-shop-435-park-rd-hurstville-nsw-2220-vyp5k3fg/all-offer?menu=true&pId=2626895') {
  const grid = document.getElementById('servicesGrid');
  if (!grid) return;

  const items = Array.isArray(services) ? services : [];
  if (!items.length) {
    grid.innerHTML = '<p class="body-sm" style="grid-column: 1 / -1; color: var(--warm-ash); padding: 1rem 0;">No services currently listed.</p>';
    return;
  }

  grid.innerHTML = items.map(s => {
    const hasPrice = Boolean(s.price && s.price.trim());
    const hasOriginal = Boolean(s.originalPrice && s.originalPrice.trim());
    const hasSavings = Boolean(s.savings && s.savings.trim());
    const hasDuration = Boolean(s.duration && s.duration.trim());
    const hasMetaRow = hasOriginal || hasSavings || hasDuration;

    return `
    <div class="glass-card--light">
      <div class="service-card-thumb">
        <img src="${s.image || 'images/services/cut-ladies.jpg'}" alt="${s.name}" loading="lazy" onerror="this.src='images/services/cut-ladies.jpg'">
      </div>
      <div class="service-card-body">
        <div class="service-card-header">
          <h3 class="heading-card">${s.name}</h3>
          ${hasPrice ? `<span class="price-val">${s.price}</span>` : ''}
        </div>
        ${hasMetaRow ? `
        <div style="margin-top: -0.25rem;">
          ${hasOriginal ? `<span class="price-original">${s.originalPrice}</span>` : ''}
          ${hasSavings ? `<span class="price-savings">${s.savings}</span>` : ''}
          ${hasDuration ? `<span class="meta-duration" style="${!hasOriginal && !hasSavings ? 'margin-left: 0;' : ''}">${s.duration}</span>` : ''}
        </div>
        ` : ''}
        <p class="body-sm" style="margin-top: 0.5rem;">
          ${s.description || ''}
        </p>
      </div>
      <div class="service-card-footer">
        <span class="caption">Tailored formulation</span>
        <a href="${bookingUrl}" target="_blank" rel="noopener noreferrer" class="caption" style="color: var(--dusty-rose); font-weight: 500;">Book Appointment →</a>
      </div>
    </div>
  `;
  }).join('');
}

/**
 * 7. Contact Form Submission Handler
 */
function initContactForm() {
  const form = document.getElementById('contactInquiryForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusDiv = document.getElementById('contactFormStatus');
    const submitBtn = document.getElementById('btnSubmitContact');
    const originalText = submitBtn.innerHTML;

    const payload = {
      name: document.getElementById('contactName').value.trim(),
      email: document.getElementById('contactEmail').value.trim(),
      phone: document.getElementById('contactPhone').value.trim(),
      message: document.getElementById('contactMessage').value.trim()
    };

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Sending...</span>';

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        form.reset();
        if (statusDiv) {
          statusDiv.style.display = 'block';
          statusDiv.style.backgroundColor = 'rgba(46, 125, 50, 0.1)';
          statusDiv.style.color = '#2e7d32';
          statusDiv.style.border = '1px solid rgba(46, 125, 50, 0.2)';
          statusDiv.textContent = data.message || 'Thank you! Your message has been received.';
        }
      } else {
        throw new Error(data.error || 'Failed to send message');
      }
    } catch (err) {
      if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.style.backgroundColor = 'rgba(179, 57, 57, 0.1)';
        statusDiv.style.color = '#b33939';
        statusDiv.style.border = '1px solid rgba(179, 57, 57, 0.2)';
        statusDiv.textContent = err.message || 'Something went wrong. Please try again.';
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
}
