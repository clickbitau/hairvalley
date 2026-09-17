/**
 * Hair Valley — Admin CMS Controller
 * Full CRUD (Create, Read, Update, Delete) for Services, Stylists, Images & Copy
 */

let siteData = {
  hero: {},
  atelier: {},
  featuredHero: {},
  promos: [],
  about: { rituals: [], stylists: [] },
  contact: { hurstville: {}, leppington: {}, hours: {} },
  categories: [],
  services: [],
  googleReviews: []
};

let deleteTarget = null; // { type: 'service' | 'stylist' | 'media', id: string, name: string }

function apiFetch(url, options = {}) {
  if (typeof window.authFetch === 'function') {
    return window.authFetch(url, options);
  }
  return fetch(url, options);
}

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initModals();
  initFileUploaders();
  initCustomSelects();
  fetchContent();
  fetchUploads();
  checkSupabaseCloudStatus();
});

/* ==========================================================================
   1. NAVIGATION & TAB SWITCHING
   ========================================================================== */
function initTabs() {
  const tabs = document.querySelectorAll('.admin-nav-item');
  const panels = document.querySelectorAll('.admin-tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = `tab-${tab.getAttribute('data-tab')}`;

      tabs.forEach(t => {
        t.classList.remove('is-active');
        t.setAttribute('aria-selected', 'false');
      });
      panels.forEach(p => p.classList.remove('is-active'));

      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');

      const targetPanel = document.getElementById(targetId);
      if (targetPanel) targetPanel.classList.add('is-active');
    });
  });
}

/* ==========================================================================
   2. DATA LOADING & POPULATION
   ========================================================================== */
async function fetchContent() {
  try {
    const res = await fetch('/api/content');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    siteData = await res.json();

    renderServices();
    renderHeroAndAtelier();
    renderStylists();
    renderRituals();
    renderContact();
    renderAdminReviews();
  } catch (err) {
    console.error('Error loading site content:', err);
    showToast('Failed to load site data. Is the server running?', 'error');
  }
}

async function checkSupabaseCloudStatus() {
  const dot = document.getElementById('supabaseStatusDot');
  const text = document.getElementById('supabaseStatusText');
  if (!dot || !text) return;

  try {
    const res = await fetch('/api/supabase-status');
    const data = await res.json();
    if (data.connected && data.tablesReady) {
      dot.style.background = '#10b981'; // green
      text.style.color = '#065f46';
      text.textContent = 'Supabase: Cloud Sync Active';
    } else if (data.connected && data.storageReady) {
      dot.style.background = '#3b82f6'; // blue
      text.style.color = '#1e40af';
      text.textContent = 'Supabase: Storage Ready (Local DB)';
    } else {
      dot.style.background = '#f59e0b'; // amber
      text.style.color = '#92400e';
      text.textContent = 'Supabase: Local Fallback';
    }
  } catch (e) {
    dot.style.background = '#94a3b8';
    text.textContent = 'Supabase: Offline';
  }
}

/* ==========================================================================
   3. SERVICES MANAGEMENT (CRUD: CREATE, READ, UPDATE, DELETE)
   ========================================================================== */

function renderServices() {
  const grid = document.getElementById('servicesGrid');
  const categoryFilter = document.getElementById('filterCategory').value;
  const searchTerm = document.getElementById('searchServicesInput').value.toLowerCase().trim();
  const countBadge = document.getElementById('servicesCountBadge');

  if (!grid) return;
  if (!siteData.services) siteData.services = [];

  const filtered = siteData.services.filter(s => {
    const matchCat = categoryFilter === 'all' || s.category === categoryFilter;
    const matchSearch = !searchTerm || 
      (s.name && s.name.toLowerCase().includes(searchTerm)) ||
      (s.description && s.description.toLowerCase().includes(searchTerm)) ||
      (s.price && s.price.toLowerCase().includes(searchTerm));
    return matchCat && matchSearch;
  });

  if (countBadge) {
    countBadge.textContent = `Showing ${filtered.length} of ${siteData.services.length} services`;
  }

  const allOptionEl = document.querySelector('#filterCategory option[value="all"]');
  if (allOptionEl) {
    allOptionEl.textContent = `All Categories (${siteData.services.length} Services)`;
  }
  syncCustomSelect(document.getElementById('filterCategory'));

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 3rem; text-align: center; background: #fff; border-radius: 12px; border: 1px dashed var(--admin-border);">
        <p style="font-size: 1.1rem; color: var(--warm-ash);">No services found matching your filter criteria.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(s => `
    <article class="service-admin-item" data-id="${s.id}">
      <div class="service-admin-thumb">
        <img src="${s.image || 'images/services/cut-ladies.jpg'}" alt="${s.name}" onerror="this.src='images/services/cut-ladies.jpg'">
      </div>
      <div class="service-admin-info">
        <div class="service-admin-category">${s.category || 'General'}</div>
        <h4 class="service-admin-name">${escapeHtml(s.name)}</h4>
        <div class="service-admin-pricing">
          <span class="service-admin-price">${escapeHtml(s.price || '')}</span>
          ${s.originalPrice ? `<span style="font-size: 0.78rem; text-decoration: line-through; color: var(--warm-ash);">${escapeHtml(s.originalPrice)}</span>` : ''}
          <span class="service-admin-dur">· ${escapeHtml(s.duration || '')}</span>
        </div>
        ${s.savings ? `<span style="font-size: 0.72rem; color: #2e7d32; font-weight: 600;">${escapeHtml(s.savings)}</span>` : ''}
        <p class="service-admin-desc">${escapeHtml(s.description || '')}</p>
        
        <!-- Action Buttons: Update & Delete -->
        <div class="service-admin-actions">
          <button type="button" class="btn-edit" onclick="openEditServiceModal('${s.id}')">
            ✏️ Edit (Update)
          </button>
          <button type="button" class="btn-danger" onclick="confirmDeleteService('${s.id}', '${escapeAttr(s.name)}')">
            🗑️ Delete
          </button>
        </div>
      </div>
    </article>
  `).join('');
}

// Filter and Search Listeners
document.getElementById('filterCategory')?.addEventListener('change', renderServices);
document.getElementById('searchServicesInput')?.addEventListener('input', renderServices);

// Open Add Service Modal
document.getElementById('btnAddNewService')?.addEventListener('click', () => {
  document.getElementById('formAddService').reset();
  openModal('modalAddService');
});

// Submit Add Service (Create)
document.getElementById('formAddService')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const newService = {
    name: document.getElementById('addServiceName').value.trim(),
    category: document.getElementById('addServiceCategory').value,
    categoryName: document.getElementById('addServiceCategory').value,
    duration: document.getElementById('addServiceDuration').value.trim(),
    price: document.getElementById('addServicePrice').value.trim(),
    originalPrice: document.getElementById('addServiceOriginalPrice').value.trim(),
    savings: document.getElementById('addServiceSavings').value.trim(),
    description: document.getElementById('addServiceDesc').value.trim(),
    image: document.getElementById('addServiceImage').value.trim() || 'images/services/cut-ladies.jpg'
  };

  try {
    const res = await apiFetch('/api/service', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newService)
    });
    const result = await res.json();
    if (res.ok && result.success) {
      siteData.services.push(result.service);
      renderServices();
      closeModal('modalAddService');
      showToast(`Service "${newService.name}" created successfully!`);
    } else {
      throw new Error(result.error || 'Failed to create service');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// Open Edit Service Modal (Update)
window.openEditServiceModal = function(id) {
  const service = siteData.services.find(s => s.id === id);
  if (!service) return;

  document.getElementById('editServiceId').value = service.id;
  document.getElementById('editServiceName').value = service.name || '';
  document.getElementById('editServiceCategory').value = service.category || '';
  document.getElementById('editServiceDuration').value = service.duration || '';
  document.getElementById('editServicePrice').value = service.price || '';
  document.getElementById('editServiceOriginalPrice').value = service.originalPrice || '';
  document.getElementById('editServiceSavings').value = service.savings || '';
  document.getElementById('editServiceDesc').value = service.description || '';
  document.getElementById('editServiceImage').value = service.image || '';

  openModal('modalEditService');
};

// Submit Edit Service (Update)
document.getElementById('formEditService')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('editServiceId').value;
  const updated = {
    id,
    name: document.getElementById('editServiceName').value.trim(),
    category: document.getElementById('editServiceCategory').value,
    categoryName: document.getElementById('editServiceCategory').value,
    duration: document.getElementById('editServiceDuration').value.trim(),
    price: document.getElementById('editServicePrice').value.trim(),
    originalPrice: document.getElementById('editServiceOriginalPrice').value.trim(),
    savings: document.getElementById('editServiceSavings').value.trim(),
    description: document.getElementById('editServiceDesc').value.trim(),
    image: document.getElementById('editServiceImage').value.trim()
  };

  try {
    const res = await apiFetch('/api/service', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });
    const result = await res.json();
    if (res.ok && result.success) {
      const idx = siteData.services.findIndex(s => s.id === id);
      if (idx !== -1) siteData.services[idx] = result.service;
      renderServices();
      closeModal('modalEditService');
      showToast(`Service "${updated.name}" updated successfully!`);
    } else {
      throw new Error(result.error || 'Failed to update service');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// Trigger Delete Confirmation for Service
window.confirmDeleteService = function(id, name) {
  deleteTarget = { type: 'service', id, name };
  document.getElementById('deleteItemTitle').textContent = `Service: "${name}"`;
  openModal('modalDeleteConfirm');
};

/* ==========================================================================
   4. STYLISTS & RITUALS (CRUD: CREATE, READ, UPDATE, DELETE)
   ========================================================================== */

function renderStylists() {
  const grid = document.getElementById('stylistsAdminGrid');
  if (!grid) return;
  siteData.about = siteData.about || {};
  siteData.about.stylists = siteData.about.stylists || [];

  grid.innerHTML = siteData.about.stylists.map(st => `
    <article class="stylist-admin-card" data-id="${st.id}">
      <img src="${st.image || 'images/stylist-1.jpg'}" alt="${st.name}" class="stylist-admin-img" onerror="this.src='images/stylist-1.jpg'">
      <div class="stylist-admin-body">
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--dusty-rose); font-weight: 600;">${escapeHtml(st.tag || '')}</span>
          <span style="font-size: 0.75rem; color: var(--warm-ash);">${escapeHtml(st.craftYears || '')}</span>
        </div>
        <h4 style="font-family: var(--font-display); font-size: 1.2rem; color: var(--espresso); margin-block: 0.15rem;">${escapeHtml(st.name)}</h4>
        <div style="font-size: 0.85rem; font-weight: 500; color: var(--dusty-rose);">${escapeHtml(st.role)}</div>
        <p style="font-size: 0.82rem; color: var(--warm-ash); line-height: 1.45; margin-top: 0.4rem; flex: 1;">${escapeHtml(st.bio)}</p>
        
        <!-- Action Buttons: Update & Delete -->
        <div style="display: flex; gap: 0.5rem; margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid var(--admin-border);">
          <button type="button" class="btn-edit" style="flex: 1;" onclick="openEditStylistModal('${st.id}')">
            ✏️ Edit (Update)
          </button>
          <button type="button" class="btn-danger" onclick="confirmDeleteStylist('${st.id}', '${escapeAttr(st.name)}')">
            🗑️ Delete
          </button>
        </div>
      </div>
    </article>
  `).join('');
}

// Add Stylist (Create)
document.getElementById('btnAddNewStylist')?.addEventListener('click', () => {
  document.getElementById('formAddStylist').reset();
  openModal('modalAddStylist');
});

document.getElementById('formAddStylist')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const stylist = {
    name: document.getElementById('addStylistName').value.trim(),
    role: document.getElementById('addStylistRole').value.trim(),
    tag: document.getElementById('addStylistTag').value.trim(),
    craftYears: document.getElementById('addStylistCraftYears').value.trim(),
    bio: document.getElementById('addStylistBio').value.trim(),
    image: document.getElementById('addStylistImage').value.trim()
  };

  try {
    const res = await apiFetch('/api/stylist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stylist)
    });
    const result = await res.json();
    if (res.ok && result.success) {
      if (!siteData.about.stylists) siteData.about.stylists = [];
      siteData.about.stylists.push(result.stylist);
      renderStylists();
      closeModal('modalAddStylist');
      showToast(`Stylist "${stylist.name}" added successfully!`);
    } else {
      throw new Error(result.error || 'Failed to add stylist');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// Edit Stylist (Update)
window.openEditStylistModal = function(id) {
  const stylist = siteData.about.stylists.find(st => st.id === id);
  if (!stylist) return;

  document.getElementById('editStylistId').value = stylist.id;
  document.getElementById('editStylistName').value = stylist.name || '';
  document.getElementById('editStylistRole').value = stylist.role || '';
  document.getElementById('editStylistTag').value = stylist.tag || '';
  document.getElementById('editStylistCraftYears').value = stylist.craftYears || '';
  document.getElementById('editStylistBio').value = stylist.bio || '';
  document.getElementById('editStylistImage').value = stylist.image || '';

  openModal('modalEditStylist');
};

document.getElementById('formEditStylist')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('editStylistId').value;
  const updated = {
    id,
    name: document.getElementById('editStylistName').value.trim(),
    role: document.getElementById('editStylistRole').value.trim(),
    tag: document.getElementById('editStylistTag').value.trim(),
    craftYears: document.getElementById('editStylistCraftYears').value.trim(),
    bio: document.getElementById('editStylistBio').value.trim(),
    image: document.getElementById('editStylistImage').value.trim()
  };

  try {
    const res = await apiFetch('/api/stylist', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });
    const result = await res.json();
    if (res.ok && result.success) {
      const idx = siteData.about.stylists.findIndex(st => st.id === id);
      if (idx !== -1) siteData.about.stylists[idx] = result.stylist;
      renderStylists();
      closeModal('modalEditStylist');
      showToast(`Stylist "${updated.name}" updated successfully!`);
    } else {
      throw new Error(result.error || 'Failed to update stylist');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// Trigger Delete Stylist
window.confirmDeleteStylist = function(id, name) {
  deleteTarget = { type: 'stylist', id, name };
  document.getElementById('deleteItemTitle').textContent = `Stylist: "${name}"`;
  openModal('modalDeleteConfirm');
};

// Render Rituals
function renderRituals() {
  const container = document.getElementById('ritualsContainer');
  if (!container) return;
  siteData.about = siteData.about || {};
  siteData.about.rituals = siteData.about.rituals || [];

  container.innerHTML = siteData.about.rituals.map((r, i) => `
    <div style="background: #fff; border: 1px solid var(--admin-border); border-radius: 12px; padding: 1.25rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <span style="font-size: 0.78rem; text-transform: uppercase; font-weight: 600; color: var(--dusty-rose);">${escapeHtml(r.movement)}</span>
        <span style="font-size: 0.8rem; color: var(--warm-ash);">Movement ${i + 1} of 3</span>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Ritual Name</label>
          <input type="text" class="form-control ritual-input-name" data-index="${i}" value="${escapeAttr(r.name)}">
        </div>
        <div class="form-group">
          <label class="form-label">Duration & Treatment Type</label>
          <input type="text" class="form-control ritual-input-dur" data-index="${i}" value="${escapeAttr(r.duration)}">
        </div>
        <div class="form-group" style="grid-column: 1 / -1;">
          <label class="form-label">Ritual Description & Methodology</label>
          <textarea class="form-control ritual-input-desc" data-index="${i}" rows="2">${escapeHtml(r.description)}</textarea>
        </div>
        <div class="form-group" style="grid-column: 1 / -1;">
          <label class="form-label">Ritual Image Path</label>
          <input type="text" class="form-control ritual-input-img" data-index="${i}" value="${escapeAttr(r.image)}">
        </div>
      </div>
    </div>
  `).join('');
}

document.getElementById('btnSaveRituals')?.addEventListener('click', async () => {
  const names = document.querySelectorAll('.ritual-input-name');
  const durs = document.querySelectorAll('.ritual-input-dur');
  const descs = document.querySelectorAll('.ritual-input-desc');
  const imgs = document.querySelectorAll('.ritual-input-img');

  names.forEach((el, i) => {
    if (siteData.about.rituals[i]) {
      siteData.about.rituals[i].name = el.value.trim();
      siteData.about.rituals[i].duration = durs[i].value.trim();
      siteData.about.rituals[i].description = descs[i].value.trim();
      siteData.about.rituals[i].image = imgs[i].value.trim();
    }
  });

  await saveFullSiteData('Salon rituals updated successfully!');
});

/* ==========================================================================
   5. EXECUTE DELETE ACTION
   ========================================================================== */
document.getElementById('btnConfirmDeleteAction')?.addEventListener('click', async () => {
  if (!deleteTarget) return;

  try {
    if (deleteTarget.type === 'service') {
      const res = await apiFetch(`/api/service?id=${encodeURIComponent(deleteTarget.id)}`, { method: 'DELETE' });
      const result = await res.json();
      if (res.ok && result.success) {
        siteData.services = siteData.services.filter(s => s.id !== deleteTarget.id);
        renderServices();
        showToast(`Service "${deleteTarget.name}" permanently deleted.`);
      } else {
        throw new Error(result.error || 'Failed to delete service');
      }
    } else if (deleteTarget.type === 'stylist') {
      const res = await apiFetch(`/api/stylist?id=${encodeURIComponent(deleteTarget.id)}`, { method: 'DELETE' });
      const result = await res.json();
      if (res.ok && result.success) {
        siteData.about.stylists = siteData.about.stylists.filter(st => st.id !== deleteTarget.id);
        renderStylists();
        showToast(`Stylist "${deleteTarget.name}" deleted.`);
      } else {
        throw new Error(result.error || 'Failed to delete stylist');
      }
    }

    closeModal('modalDeleteConfirm');
    deleteTarget = null;
  } catch (err) {
    showToast(err.message, 'error');
  }
});

/* ==========================================================================
   6. HERO & ATELIER SECTION UPDATES
   ========================================================================== */
function renderHeroAndAtelier() {
  if (siteData.hero) {
    document.getElementById('heroEyebrow').value = siteData.hero.eyebrow || '';
    document.getElementById('heroTitle').value = siteData.hero.title || '';
    document.getElementById('heroQuote').value = siteData.hero.quote || '';
    document.getElementById('heroBackgroundImage').value = siteData.hero.backgroundImage || '';
    document.getElementById('heroImagePreview').src = siteData.hero.backgroundImage || 'images/hero-lying.jpg';
  }

  if (siteData.atelier) {
    document.getElementById('atelierEyebrow').value = siteData.atelier.eyebrow || '';
    document.getElementById('atelierTitle').value = siteData.atelier.title || '';
    document.getElementById('atelierSubtitle').value = siteData.atelier.subtitle || '';
    document.getElementById('atelierQuote').value = siteData.atelier.quote || '';
    document.getElementById('atelierArchImage').value = siteData.atelier.archModelImage || '';
    document.getElementById('atelierImagePreview').src = siteData.atelier.archModelImage || 'images/hero.jpg';
  }
}

document.getElementById('btnSaveHero')?.addEventListener('click', async () => {
  siteData.hero = {
    ...siteData.hero,
    eyebrow: document.getElementById('heroEyebrow').value.trim(),
    title: document.getElementById('heroTitle').value.trim(),
    quote: document.getElementById('heroQuote').value.trim(),
    backgroundImage: document.getElementById('heroBackgroundImage').value.trim()
  };

  siteData.atelier = {
    ...siteData.atelier,
    eyebrow: document.getElementById('atelierEyebrow').value.trim(),
    title: document.getElementById('atelierTitle').value.trim(),
    subtitle: document.getElementById('atelierSubtitle').value.trim(),
    quote: document.getElementById('atelierQuote').value.trim(),
    archModelImage: document.getElementById('atelierArchImage').value.trim()
  };

  await saveFullSiteData('Hero & Homepage sections updated successfully!');
});

/* ==========================================================================
   7. CONTACT & HOURS SECTION UPDATES
   ========================================================================== */
function renderContact() {
  siteData.contact = siteData.contact || {};
  if (siteData.contact.hurstville) {
    const branchName = siteData.contact.hurstville.name || '';
    document.getElementById('contactHurstvilleName').value = branchName;
    const headingEl = document.getElementById('contactHurstvilleHeading');
    if (headingEl) headingEl.textContent = branchName ? `${branchName} — Salon Location` : 'Flagship Salon Location';
    const subtitleEl = document.getElementById('contactPageSubtitle');
    if (subtitleEl) subtitleEl.textContent = `Update ${branchName || 'flagship salon'} details, Leppington appointments, and weekly schedule.`;
    document.getElementById('contactHurstvillePhone').value = siteData.contact.hurstville.phone || '';
    document.getElementById('contactHurstvilleEmail').value = siteData.contact.hurstville.email || '';
    document.getElementById('contactHurstvilleAddress').value = siteData.contact.hurstville.address || '';
    document.getElementById('contactHurstvilleLandmark').value = siteData.contact.hurstville.landmark || '';
  }
  if (siteData.contact.leppington) {
    document.getElementById('contactLeppingtonName').value = siteData.contact.leppington.name || '';
    document.getElementById('contactLeppingtonSms').value = siteData.contact.leppington.sms || '';
    document.getElementById('contactLeppingtonEmail').value = siteData.contact.leppington.email || '';
    document.getElementById('contactLeppingtonPolicy').value = siteData.contact.leppington.instructions || '';
  }
  if (siteData.contact.hours) {
    document.getElementById('hoursStandard').value = siteData.contact.hours.standard || '';
    document.getElementById('hoursThursday').value = siteData.contact.hours.thursday || '';
    document.getElementById('hoursSunday').value = siteData.contact.hours.sunday || '';
  }
  if (siteData.contact.bookingDeposit) {
    document.getElementById('bookingDeposit').value = siteData.contact.bookingDeposit;
  }
  if (siteData.contact.bookingUrl) {
    document.getElementById('bookingUrl').value = siteData.contact.bookingUrl;
  }
}

document.getElementById('contactHurstvilleName')?.addEventListener('input', (e) => {
  const headingEl = document.getElementById('contactHurstvilleHeading');
  if (headingEl) {
    const val = e.target.value.trim();
    headingEl.textContent = val ? `${val} — Salon Location` : 'Flagship Salon Location';
  }
});

document.getElementById('btnSaveContact')?.addEventListener('click', async () => {
  siteData.contact = siteData.contact || {};
  siteData.contact.hurstville = {
    ...siteData.contact.hurstville,
    name: document.getElementById('contactHurstvilleName').value.trim(),
    phone: document.getElementById('contactHurstvillePhone').value.trim(),
    email: document.getElementById('contactHurstvilleEmail').value.trim(),
    address: document.getElementById('contactHurstvilleAddress').value.trim(),
    landmark: document.getElementById('contactHurstvilleLandmark').value.trim()
  };

  siteData.contact.leppington = {
    ...siteData.contact.leppington,
    name: document.getElementById('contactLeppingtonName').value.trim(),
    sms: document.getElementById('contactLeppingtonSms').value.trim(),
    email: document.getElementById('contactLeppingtonEmail').value.trim(),
    instructions: document.getElementById('contactLeppingtonPolicy').value.trim()
  };

  if (Array.isArray(siteData.branches)) {
    const hb = siteData.branches.find(b => b.id === 'hurstville');
    if (hb) {
      hb.name = siteData.contact.hurstville.name;
      hb.phone = siteData.contact.hurstville.phone;
      hb.email = siteData.contact.hurstville.email;
      hb.address = siteData.contact.hurstville.address;
    }
    const lb = siteData.branches.find(b => b.id === 'leppington');
    if (lb) {
      lb.name = siteData.contact.leppington.name;
      lb.phone = siteData.contact.leppington.sms;
      lb.sms = siteData.contact.leppington.sms;
      lb.email = siteData.contact.leppington.email;
      lb.policy = siteData.contact.leppington.instructions;
    }
  }

  siteData.contact.hours = {
    ...siteData.contact.hours,
    standard: document.getElementById('hoursStandard').value.trim(),
    thursday: document.getElementById('hoursThursday').value.trim(),
    sunday: document.getElementById('hoursSunday').value.trim()
  };

  siteData.contact.bookingDeposit = document.getElementById('bookingDeposit').value.trim();
  siteData.contact.bookingUrl = document.getElementById('bookingUrl').value.trim();

  await saveFullSiteData('Contact details and online booking settings updated successfully!');
});

/* ==========================================================================
   8. MEDIA LIBRARY & LOCAL IMAGE UPLOAD (BASE64)
   ========================================================================== */
function initFileUploaders() {
  // Generic handler for file input uploads
  setupLocalUploader('heroImageFileInput', (url) => {
    document.getElementById('heroBackgroundImage').value = url;
    document.getElementById('heroImagePreview').src = url;
    showToast('Hero image uploaded! Click Save to apply.');
  });

  setupLocalUploader('atelierImageFileInput', (url) => {
    document.getElementById('atelierArchImage').value = url;
    document.getElementById('atelierImagePreview').src = url;
    showToast('Arch portal image uploaded! Click Save to apply.');
  });

  setupLocalUploader('editServiceFileInput', (url) => {
    document.getElementById('editServiceImage').value = url;
    showToast('Service image attached.');
  });

  setupLocalUploader('addServiceFileInput', (url) => {
    document.getElementById('addServiceImage').value = url;
    showToast('Service image attached.');
  });

  setupLocalUploader('editStylistFileInput', (url) => {
    document.getElementById('editStylistImage').value = url;
    showToast('Stylist photo attached.');
  });

  setupLocalUploader('addStylistFileInput', (url) => {
    document.getElementById('addStylistImage').value = url;
    showToast('Stylist photo attached.');
  });

  // Media Tab Dropzone
  const dropZone = document.getElementById('mediaUploadZone');
  const fileInput = document.getElementById('mediaFileInput');

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('is-dragover');
    });

    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('is-dragover'));

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('is-dragover');
      if (e.dataTransfer.files.length) {
        uploadFile(e.dataTransfer.files[0], () => fetchUploads());
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) {
        uploadFile(fileInput.files[0], () => fetchUploads());
        fileInput.value = '';
      }
    });
  }

  document.getElementById('btnRefreshUploads')?.addEventListener('click', fetchUploads);
}

function setupLocalUploader(inputId, onSuccess) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.addEventListener('change', () => {
    if (input.files.length) {
      uploadFile(input.files[0], onSuccess);
      input.value = '';
    }
  });
}

function uploadFile(file, callback) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    showToast('Unsupported format. Please upload JPG, PNG, or WebP.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const base64Data = reader.result;
      const res = await apiFetch('/api/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          data: base64Data
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Image "${data.filename}" uploaded successfully!`);
        if (callback) callback(data.url);
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
  reader.readAsDataURL(file);
}

async function fetchUploads() {
  const grid = document.getElementById('mediaGalleryGrid');
  if (!grid) return;

  try {
    const res = await fetch('/api/uploads');
    if (!res.ok) throw new Error('Failed to load uploads');
    const data = await res.json();
    const files = Array.isArray(data) ? data : (data.files || []);

    if (!files.length) {
      grid.innerHTML = '<p style="grid-column: 1 / -1; color: var(--warm-ash); font-size: 0.9rem; padding: 1.5rem; text-align: center;">No uploaded media yet. Upload your first image above.</p>';
      return;
    }

    grid.innerHTML = files.map(f => `
      <div style="background: #fff; border: 1px solid var(--admin-border); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column;">
        <div style="aspect-ratio: 4 / 3; background: var(--blush-veil); overflow: hidden;">
          <img src="${f.url}" alt="${f.filename}" style="width: 100%; height: 100%; object-fit: cover;">
        </div>
        <div style="padding: 0.75rem; display: flex; flex-direction: column; gap: 0.35rem; flex: 1;">
          <div style="font-size: 0.78rem; font-weight: 600; color: var(--espresso); word-break: break-all;">${escapeHtml(f.filename)}</div>
          <div style="font-size: 0.72rem; color: var(--warm-ash);">${(f.size / 1024).toFixed(1)} KB</div>
          <div style="display: flex; gap: 0.4rem; margin-top: auto; padding-top: 0.5rem;">
            <button type="button" class="btn-edit" style="font-size: 0.72rem; padding: 0.3rem 0.6rem; flex: 1;" onclick="copyPathToClipboard('${f.url}')">Copy Path</button>
            <button type="button" class="btn-danger" style="font-size: 0.72rem; padding: 0.3rem 0.6rem;" onclick="deleteUploadedImage('${escapeAttr(f.filename)}')">Delete</button>
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = '<p style="grid-column: 1 / -1; color: var(--warm-ash); font-size: 0.85rem;">Failed to load uploads.</p>';
  }
}

window.copyPathToClipboard = function(path) {
  navigator.clipboard.writeText(path).then(() => {
    showToast(`Copied "${path}" to clipboard!`);
  });
};

window.deleteUploadedImage = async function(filename) {
  if (!confirm(`Permanently delete "${filename}" from server storage?`)) return;
  try {
    const res = await apiFetch(`/api/delete-image?filename=${encodeURIComponent(filename)}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`Image deleted.`);
      fetchUploads();
    } else {
      throw new Error(data.error || 'Failed to delete image');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
};

/* ==========================================================================
   9. GLOBAL SAVE HELPER
   ========================================================================== */
async function saveFullSiteData(successMessage = 'Changes saved successfully!') {
  try {
    const res = await apiFetch('/api/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(siteData)
    });
    const result = await res.json();
    if (res.ok && result.success) {
      showToast(successMessage);
    } else {
      throw new Error(result.error || 'Failed to save changes');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ==========================================================================
   9.5. GOOGLE REVIEWS MANAGEMENT
   ========================================================================== */
function renderAdminReviews() {
  const container = document.getElementById('adminReviewsList');
  const countSpan = document.getElementById('adminReviewsCount');
  if (!container) return;

  const reviews = siteData.googleReviews || [];
  if (countSpan) countSpan.textContent = reviews.length;

  if (reviews.length === 0) {
    container.innerHTML = '<p style="color: var(--warm-ash); font-size: 0.9rem;">No reviews found.</p>';
    return;
  }

  container.innerHTML = reviews.map((r) => `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 1.25rem; background: #faf9f6; border: 1px solid var(--admin-border); border-radius: 8px; gap: 1.25rem;">
      <div style="flex: 1;">
        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.4rem;">
          <div style="width: 36px; height: 36px; border-radius: 50%; overflow: hidden; background: #e2dcd5; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.85rem; color: var(--espresso); flex-shrink: 0;">
            ${r.avatar ? `<img src="${r.avatar}" alt="${escapeHtml(r.author)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.parentElement.textContent='${escapeHtml(r.initials || r.author.charAt(0))}';">` : escapeHtml(r.initials || r.author.charAt(0))}
          </div>
          <div>
            <strong style="color: var(--espresso); font-size: 0.95rem;">${escapeHtml(r.author)}</strong>
            <span style="font-size: 0.75rem; color: var(--warm-ash); margin-left: 0.5rem;">${escapeHtml(r.badge || '')}</span>
          </div>
        </div>
        <div style="color: #f59e0b; font-size: 0.9rem; margin-bottom: 0.4rem;">${'★'.repeat(r.rating || 5)}</div>
        <p style="font-size: 0.88rem; color: var(--espresso); line-height: 1.5; margin-bottom: 0.5rem; font-style: italic;">“${escapeHtml(r.text)}”</p>
        <div style="display: flex; align-items: center; gap: 0.75rem; font-size: 0.78rem;">
          <span style="color: #10b981; font-weight: 500;">✓ ${escapeHtml(r.date || 'Google Verified')}</span>
          <a href="${escapeHtml((r.link && !r.link.includes('share.google')) ? r.link : (siteData.googleReviewsUrl || 'https://www.google.com/search?q=hairvalley#lrd=0x6b12b9bd54b2f7d5:0x43db3c39bbc456b0,1,,,,'))}" target="_blank" rel="noopener noreferrer" style="color: var(--dusty-rose); text-decoration: none; font-weight: 500;">View on Google ↗</a>
        </div>
      </div>
      <div>
        <button type="button" class="btn-edit" onclick="openEditReview('${r.id}')" style="white-space: nowrap;">Edit Review</button>
      </div>
    </div>
  `).join('');
}

window.openEditReview = function(id) {
  const reviews = siteData.googleReviews || [];
  const review = reviews.find(r => r.id === id);
  if (!review) return;

  const defaultUrl = siteData.googleReviewsUrl || 'https://www.google.com/search?q=hairvalley#lrd=0x6b12b9bd54b2f7d5:0x43db3c39bbc456b0,1,,,,';

  document.getElementById('editReviewId').value = review.id;
  document.getElementById('editReviewAuthor').value = review.author || '';
  document.getElementById('editReviewBadge').value = review.badge || '';
  document.getElementById('editReviewRating').value = String(review.rating || 5);
  document.getElementById('editReviewDate').value = review.date || 'Google Verified';
  document.getElementById('editReviewLink').value = (review.link && !review.link.includes('share.google')) ? review.link : defaultUrl;
  document.getElementById('editReviewText').value = review.text || '';

  openModal('modalEditReview');
};

async function handleSaveReview(e) {
  e.preventDefault();
  const id = document.getElementById('editReviewId').value;
  const reviews = siteData.googleReviews || [];
  const review = reviews.find(r => r.id === id);
  if (!review) return;

  const defaultUrl = siteData.googleReviewsUrl || 'https://www.google.com/search?q=hairvalley#lrd=0x6b12b9bd54b2f7d5:0x43db3c39bbc456b0,1,,,,';

  review.author = document.getElementById('editReviewAuthor').value.trim();
  review.badge = document.getElementById('editReviewBadge').value.trim();
  review.rating = parseInt(document.getElementById('editReviewRating').value, 10) || 5;
  review.date = document.getElementById('editReviewDate').value.trim() || 'Google Verified';
  review.link = document.getElementById('editReviewLink').value.trim() || defaultUrl;
  review.text = document.getElementById('editReviewText').value.trim();

  if (!review.avatar && review.author) {
    const parts = review.author.split(' ');
    review.initials = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : review.author.slice(0, 2).toUpperCase();
  }

  try {
    const res = await apiFetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviews })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('Google Review updated successfully!');
      closeModal('modalEditReview');
      renderAdminReviews();
    } else {
      throw new Error(data.error || 'Failed to update review');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleSyncGoogleReviews() {
  const btn = document.getElementById('btnSyncGoogleReviews');
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
      </svg>
      <span>Syncing Live...</span>
    `;
  }

  try {
    const res = await apiFetch('/api/reviews/sync-google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message || 'Google Reviews synchronized!');
      if (Array.isArray(data.reviews)) {
        siteData.googleReviews = data.reviews;
        renderAdminReviews();
      }
    } else {
      throw new Error(data.message || data.error || 'Failed to sync Google reviews');
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

/* ==========================================================================
   10. MODAL & TOAST UTILITIES
   ========================================================================== */
function initModals() {
  const formEditReview = document.getElementById('formEditReview');
  if (formEditReview) {
    formEditReview.addEventListener('submit', handleSaveReview);
  }

  const btnSyncGoogle = document.getElementById('btnSyncGoogleReviews');
  if (btnSyncGoogle) {
    btnSyncGoogle.addEventListener('click', handleSyncGoogleReviews);
  }

  // Close modals when clicking backdrop
  document.querySelectorAll('.admin-modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.classList.remove('is-open');
      }
    });
  });
}

window.openModal = function(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('is-open');
    syncAllCustomSelects(el);
  }
};

window.closeModal = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('is-open');
};

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast--error' : 'toast--success'}`;
  toast.innerHTML = `
    <span>${type === 'error' ? '⚠️' : '✓'}</span>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

/* ==========================================================================
   11. CUSTOM SELECT DROPDOWNS (brand-styled replacement for native <select>)
   The native <select> stays mounted (visually hidden) as the source of truth:
   all existing .value reads/writes and change listeners keep working.
   ========================================================================== */
const HV_SELECT_CHEVRON = '<svg class="hv-select-chevron" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>';

function initCustomSelects() {
  document.querySelectorAll('select.js-hv-select').forEach(enhanceSelect);

  document.addEventListener('click', (e) => {
    document.querySelectorAll('.hv-select.is-open').forEach(wrap => {
      if (!wrap.contains(e.target)) closeCustomSelect(wrap);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.hv-select.is-open').forEach(closeCustomSelect);
    }
  });
}

function enhanceSelect(select) {
  const wrap = document.createElement('div');
  wrap.className = 'hv-select' + (select.dataset.variant === 'pill' ? ' hv-select--pill' : '');

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'hv-select-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.innerHTML = `<span class="hv-select-label"></span>${HV_SELECT_CHEVRON}`;

  const list = document.createElement('ul');
  list.className = 'hv-select-list';
  list.setAttribute('role', 'listbox');

  select.classList.add('hv-select-native');
  select.setAttribute('aria-hidden', 'true');
  select.tabIndex = -1;

  select.parentNode.insertBefore(wrap, select);
  wrap.appendChild(select);
  wrap.appendChild(trigger);
  wrap.appendChild(list);

  syncCustomSelect(select);

  trigger.addEventListener('click', () => {
    const wasOpen = wrap.classList.contains('is-open');
    document.querySelectorAll('.hv-select.is-open').forEach(closeCustomSelect);
    if (!wasOpen) openCustomSelect(wrap);
  });

  trigger.addEventListener('keydown', (e) => {
    const options = Array.from(list.querySelectorAll('.hv-select-option'));
    if (!options.length) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!wrap.classList.contains('is-open')) {
        openCustomSelect(wrap);
        return;
      }
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      const cur = options.findIndex(o => o.classList.contains('is-highlighted'));
      const sel = options.findIndex(o => o.classList.contains('is-selected'));
      const base = cur !== -1 ? cur : (sel !== -1 ? sel : (dir === 1 ? -1 : 0));
      const next = (base + dir + options.length) % options.length;
      options.forEach(o => o.classList.remove('is-highlighted'));
      options[next].classList.add('is-highlighted');
      options[next].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!wrap.classList.contains('is-open')) {
        openCustomSelect(wrap);
      } else {
        const target = list.querySelector('.hv-select-option.is-highlighted')
          || list.querySelector('.hv-select-option.is-selected')
          || options[0];
        target.click();
      }
    }
  });

  // Block native Space-key activation on the button; handled in keydown above.
  trigger.addEventListener('keyup', (e) => {
    if (e.key === ' ') e.preventDefault();
  });

  // Keep the custom UI in sync when the native select fires change.
  select.addEventListener('change', () => syncCustomSelect(select));

  // form.reset() restores native values — re-sync once it has applied.
  if (select.form) {
    select.form.addEventListener('reset', () => {
      setTimeout(() => syncCustomSelect(select), 0);
    });
  }
}

function openCustomSelect(wrap) {
  const select = wrap.querySelector('select');
  if (select) syncCustomSelect(select);
  wrap.classList.add('is-open');
  const trigger = wrap.querySelector('.hv-select-trigger');
  trigger.classList.add('is-open');
  trigger.setAttribute('aria-expanded', 'true');
}

function closeCustomSelect(wrap) {
  wrap.classList.remove('is-open');
  const trigger = wrap.querySelector('.hv-select-trigger');
  if (trigger) {
    trigger.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
  }
}

function syncAllCustomSelects(container) {
  (container || document).querySelectorAll('select.js-hv-select').forEach(syncCustomSelect);
}

function syncCustomSelect(select) {
  const wrap = select.closest('.hv-select');
  if (!wrap) return;

  // Rebuild items from live <option> elements so dynamically-updated
  // labels (e.g. "All Categories (N Services)") are reflected.
  const list = wrap.querySelector('.hv-select-list');
  list.innerHTML = '';
  Array.from(select.options).forEach(opt => {
    const li = document.createElement('li');
    li.className = 'hv-select-option';
    li.setAttribute('role', 'option');
    li.dataset.value = opt.value;
    li.textContent = opt.textContent;
    if (opt.value === select.value) {
      li.classList.add('is-selected');
      li.setAttribute('aria-selected', 'true');
    }
    li.addEventListener('click', () => {
      select.value = opt.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      closeCustomSelect(wrap);
      wrap.querySelector('.hv-select-trigger').focus();
    });
    list.appendChild(li);
  });

  const label = wrap.querySelector('.hv-select-label');
  const current = select.options[select.selectedIndex];
  label.textContent = current ? current.textContent : '';
}
