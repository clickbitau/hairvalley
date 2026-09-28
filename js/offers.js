/**
 * Hair Valley — Dynamic Offers & Navbar Announcement Client
 * Manages Supabase/CMS driven navbar announcement & homepage offer campaign
 */
(function() {
  const FRESHA_URL = 'https://www.fresha.com/a/hairvalley-hurstville-shop-435-park-rd-hurstville-nsw-2220-vyp5k3fg/all-offer?menu=true&pId=2626895';

  async function initOffers() {
    try {
      const res = await fetch('/api/content');
      if (!res.ok) return;
      const data = await res.json();

      // 1. Top Navbar Announcement Bar
      // RULE: Hidden by default. Only show if explicitly enabled AND non-empty offer text is given.
      const annBar = document.getElementById('siteAnnouncementBar');
      const annText = document.getElementById('announcementText');
      const annBadge = document.getElementById('announcementBadge');
      const annLink = document.getElementById('announcementLink');

      const ann = data.announcement;
      const isAnnEnabled = ann && ann.enabled === true;
      const hasAnnText = ann && typeof ann.text === 'string' && ann.text.trim() !== '';

      if (annBar && isAnnEnabled && hasAnnText) {
        if (annText) annText.textContent = ann.text.trim();

        if (annBadge) {
          if (ann.badge && ann.badge.trim() !== '') {
            annBadge.textContent = ann.badge.trim();
            annBadge.style.display = 'inline-block';
          } else {
            annBadge.style.display = 'none';
          }
        }

        if (annLink) {
          const customLink = (ann.link || '').trim();
          annLink.href = customLink !== '' ? customLink : FRESHA_URL;
          annLink.target = '_blank';
          annLink.rel = 'noopener noreferrer';
          annLink.textContent = ann.button_text || ann.buttonText || 'Book with Offer →';
        }
        annBar.style.display = 'block';
      } else if (annBar) {
        // By default it does NOT show anything
        annBar.style.display = 'none';
      }

      // 2. Homepage Promotional Offer Section
      // RULE: Hidden by default. ONLY show if admin uploaded an offer image AND section is enabled.
      const offerSection = document.getElementById('offerCampaignSection');
      const offerImg = document.getElementById('offerCampaignImage');
      const offerTitle = document.getElementById('offerCampaignTitle');
      const offerDesc = document.getElementById('offerCampaignDescription');
      const offerEyebrow = document.getElementById('offerCampaignEyebrow');
      const offerTag = document.getElementById('offerFloatingTag');
      const offerBtn = document.getElementById('offerCampaignBtn');

      if (offerSection) {
        const promo = data.promotional_offer;
        const hasImage = promo && typeof promo.image === 'string' && promo.image.trim() !== '';
        const isOfferEnabled = promo && promo.enabled === true;

        if (hasImage && isOfferEnabled) {
          if (offerImg) offerImg.src = promo.image.trim();
          if (offerTitle) offerTitle.textContent = promo.title || 'Exclusive Salon Offer';
          if (offerDesc) offerDesc.textContent = promo.description || '';

          if (offerEyebrow) {
            if (promo.eyebrow && promo.eyebrow.trim() !== '') {
              offerEyebrow.textContent = promo.eyebrow.trim();
              offerEyebrow.style.display = '';
            } else {
              offerEyebrow.style.display = 'none';
            }
          }

          if (offerTag) {
            if (promo.badge && promo.badge.trim() !== '') {
              offerTag.textContent = promo.badge.trim();
              offerTag.style.display = '';
            } else {
              offerTag.style.display = 'none';
            }
          }

          if (offerBtn) {
            const bUrl = (promo.button_url || promo.buttonUrl || '').trim();
            offerBtn.href = bUrl !== '' ? bUrl : FRESHA_URL;
            offerBtn.target = '_blank';
            offerBtn.rel = 'noopener noreferrer';
            offerBtn.textContent = promo.button_text || promo.buttonText || 'Book Now →';
          }
          offerSection.style.display = 'block';
        } else {
          // By default it does NOT show anything
          offerSection.style.display = 'none';
        }
      }
    } catch (err) {
      console.warn('[Offers] Notice loading dynamic offers:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOffers);
  } else {
    initOffers();
  }
})();
