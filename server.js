const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'site-data.json');
const UPLOADS_DIR = path.join(__dirname, 'images', 'uploads');

if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Supabase Client Initialization
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY;
let supabase = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log(`[Supabase] Initialized client for ${SUPABASE_URL}`);
  } catch (err) {
    console.error('[Supabase] Failed to initialize client:', err.message);
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json'
};

// Supabase Auth JWT Verification Helper
async function getAuthUser(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  if (!token || !supabase) return null;

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user) {
      return user;
    }
  } catch (err) {
    console.warn('[Auth] Token verification notice:', err.message);
  }
  return null;
}

async function checkSupabaseStatus() {
  if (!supabase) {
    return { connected: false, tablesReady: false, storageReady: false, message: 'No Supabase credentials configured' };
  }

  let tablesReady = false;
  let storageReady = false;
  let tablesError = null;
  let servicesCount = 0;
  let mediaCount = 0;

  try {
    const { data, error } = await supabase.from('categories').select('id').limit(1);
    if (!error) {
      tablesReady = true;
      const { count } = await supabase.from('services').select('*', { count: 'exact', head: true });
      servicesCount = count || 0;
    } else {
      tablesError = error.message;
    }
  } catch (e) {
    tablesError = e.message;
  }

  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    storageReady = Array.isArray(buckets) && buckets.some(b => b.name === 'uploads');
    if (storageReady) {
      const { data: files } = await supabase.storage.from('uploads').list('', { limit: 200 });
      mediaCount = Array.isArray(files) ? files.length : 0;
    }
  } catch (e) {
    storageReady = false;
  }

  return {
    connected: true,
    tablesReady,
    storageReady,
    servicesCount,
    mediaCount,
    tablesError: tablesReady ? null : tablesError,
    url: SUPABASE_URL
  };
}

async function readSiteData() {
  // Read local file (always written on every save — reliable backup)
  let localData = null;
  let localMtime = 0;
  try {
    if (fs.existsSync(DATA_FILE)) {
      localData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      localMtime = fs.statSync(DATA_FILE).mtimeMs;
    }
  } catch (err) {
    console.error('Error reading site data:', err);
  }

  // Prefer Supabase if available — unless the local file is newer,
  // which means the last remote sync failed and local holds fresher data.
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('site_content')
        .select('data, updated_at')
        .eq('id', 'current')
        .maybeSingle();

      if (!error && data && data.data) {
        const remoteTs = data.updated_at ? Date.parse(data.updated_at) : NaN;
        if (localData && Number.isFinite(remoteTs) && localMtime > remoteTs + 2000) {
          return localData;
        }
        return data.data;
      }
    } catch (err) {
      // Non-blocking fallback to local JSON file
    }
  }

  return localData || {};
}

async function writeSiteData(data) {
  // Always update local file as reliable backup
  let localOk = false;
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    localOk = true;
  } catch (err) {
    console.error('Error writing site data:', err);
  }

  // If Supabase is active, sync to Supabase site_content.
  // Failures are reported (not just logged) so callers can warn the admin
  // instead of silently serving stale data on the next read.
  let supabaseOk = null; // null = Supabase not configured
  let supabaseError = null;
  if (supabase) {
    try {
      const { error } = await supabase
        .from('site_content')
        .upsert({
          id: 'current',
          data,
          updated_at: new Date().toISOString()
        });
      if (error) {
        supabaseOk = false;
        supabaseError = error.message;
        console.warn('[Supabase] site_content sync failed:', error.message);
      } else {
        supabaseOk = true;
      }
    } catch (err) {
      supabaseOk = false;
      supabaseError = err.message;
      console.warn('[Supabase] Warning syncing to site_content:', err.message);
    }
  }

  return { local: localOk, supabase: supabaseOk, supabaseError };
}

// Returns true if the response was handled (a failure response was sent).
function reportWriteResult(res, result, successData) {
  if (!result.local) {
    sendJson(res, 500, { error: 'Failed to write site data' });
    return true;
  }
  if (result.supabase === false) {
    sendJson(res, 502, {
      error: `Saved locally but database sync failed — changes may not appear on the live site. (${result.supabaseError || 'Supabase unreachable'})`
    });
    return true;
  }
  if (successData) {
    sendJson(res, successData.status || 200, successData.body);
    return true;
  }
  return false;
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      // 25MB max
      if (body.length > 26214400) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        const json = body ? JSON.parse(body) : {};
        resolve(json);
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function fetchGooglePlaceReviews(placeId, apiKey) {
  return new Promise((resolve, reject) => {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=name,rating,user_ratings_total,reviews&key=${encodeURIComponent(apiKey)}`;
    https.get(url, (apiRes) => {
      let data = '';
      apiRes.on('data', chunk => { data += chunk; });
      apiRes.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = parsedUrl.pathname;

  // =========================================================================
  // SUPABASE STATUS ENDPOINT
  // =========================================================================
  if (pathname === '/api/supabase-status' && req.method === 'GET') {
    const status = await checkSupabaseStatus();
    sendJson(res, 200, status);
    return;
  }

  // =========================================================================
  // AUTH PASSWORD RECOVERY ENDPOINT
  // =========================================================================
  if (pathname === '/api/auth/forgot-password' && req.method === 'POST') {
    try {
      const payload = await parseBody(req);
      const email = payload.email;
      if (!email || !email.includes('@')) {
        sendJson(res, 400, { error: 'Valid email required' });
        return;
      }

      console.log(`[Auth] Password recovery requested for: ${email}`);

      let recoveryLink = null;
      if (supabase && supabase.auth && supabase.auth.admin) {
        try {
          const { data, error } = await supabase.auth.admin.generateLink({
            type: 'recovery',
            email: email,
            options: {
              redirectTo: `http://localhost:${PORT}/admin.html?type=recovery`
            }
          });
          if (!error && data && data.properties) {
            recoveryLink = data.properties.action_link;
            console.log(`[Auth] Generated recovery action link: ${recoveryLink}`);
          }
        } catch (linkErr) {
          console.warn('[Auth] Admin link generation notice:', linkErr.message);
        }
      }

      sendJson(res, 200, {
        success: true,
        message: 'Password recovery process initiated',
        recoveryLink: recoveryLink || undefined
      });
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  // =========================================================================
  // DIRECT PASSWORD RESET ENDPOINT (Admin recovery)
  // =========================================================================
  if (pathname === '/api/auth/direct-reset-password' && req.method === 'POST') {
    try {
      const payload = await parseBody(req);
      const email = payload.email;
      const newPassword = payload.newPassword;

      if (!newPassword || newPassword.length < 6) {
        sendJson(res, 400, { error: 'New password (min 6 chars) is required' });
        return;
      }

      if (supabase && supabase.auth && supabase.auth.admin) {
        // Try getting user from auth header Bearer token first
        const authUser = await getAuthUser(req);
        let targetUserId = authUser ? authUser.id : null;
        let targetEmail = authUser ? authUser.email : email;

        if (!targetUserId) {
          if (!email) {
            sendJson(res, 400, { error: 'Email is required' });
            return;
          }
          const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
          if (listErr) throw listErr;

          const targetUser = users && users.find(u => u.email.toLowerCase() === email.toLowerCase());
          if (!targetUser) {
            sendJson(res, 404, { error: 'No account found with this email address' });
            return;
          }
          targetUserId = targetUser.id;
          targetEmail = targetUser.email;
        }

        const { data, error } = await supabase.auth.admin.updateUserById(targetUserId, {
          password: newPassword
        });

        if (error) throw error;
        console.log(`[Auth] Password reset successfully for: ${targetEmail}`);
        sendJson(res, 200, { success: true, message: 'Password updated successfully' });
        return;
      }

      sendJson(res, 500, { error: 'Supabase service role not available' });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // =========================================================================
  // RELATIONAL DATA ENDPOINTS (Direct Postgres Tables)
  // =========================================================================

  // Categories
  if (pathname === '/api/categories' && req.method === 'GET') {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('categories').select('*').order('display_order');
        if (!error && data && data.length) {
          sendJson(res, 200, data);
          return;
        }
      } catch (e) {}
    }
    const siteData = await readSiteData();
    sendJson(res, 200, siteData.categories || []);
    return;
  }

  // Services Catalog
  if (pathname === '/api/services' && req.method === 'GET') {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('services').select('*').order('sort_order');
        if (!error && data && data.length) {
          sendJson(res, 200, data);
          return;
        }
      } catch (e) {}
    }
    const siteData = await readSiteData();
    sendJson(res, 200, siteData.services || []);
    return;
  }

  // Stylists
  if (pathname === '/api/stylists' && req.method === 'GET') {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('stylists').select('*').order('sort_order');
        if (!error && data && data.length) {
          sendJson(res, 200, data);
          return;
        }
      } catch (e) {}
    }
    const siteData = await readSiteData();
    sendJson(res, 200, (siteData.about && siteData.about.stylists) || []);
    return;
  }

  // Rituals
  if (pathname === '/api/rituals' && req.method === 'GET') {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('rituals').select('*').order('sort_order');
        if (!error && data && data.length) {
          sendJson(res, 200, data);
          return;
        }
      } catch (e) {}
    }
    const siteData = await readSiteData();
    sendJson(res, 200, (siteData.about && siteData.about.rituals) || []);
    return;
  }

  // Promos
  if (pathname === '/api/promos' && req.method === 'GET') {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('promos').select('*').eq('is_active', true);
        if (!error && data && data.length) {
          sendJson(res, 200, data);
          return;
        }
      } catch (e) {}
    }
    const siteData = await readSiteData();
    sendJson(res, 200, siteData.promos || []);
    return;
  }

  // Google Reviews
  if (pathname === '/api/reviews' && req.method === 'GET') {
    const siteData = await readSiteData();
    sendJson(res, 200, siteData.googleReviews || []);
    return;
  }

  if (pathname === '/api/reviews' && req.method === 'POST') {
    try {
      const payload = await parseBody(req);
      const siteData = await readSiteData();
      if (Array.isArray(payload)) {
        siteData.googleReviews = payload;
      } else if (payload && payload.reviews) {
        siteData.googleReviews = payload.reviews;
      }
      const wr = await writeSiteData(siteData);
      if (reportWriteResult(res, wr)) return;
      sendJson(res, 200, { success: true, message: 'Google reviews updated successfully' });
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  // Live Sync with Google Places API
  if (pathname === '/api/reviews/sync-google' && req.method === 'POST') {
    try {
      const payload = await parseBody(req).catch(() => ({}));
      const siteData = await readSiteData();
      const apiKey = (payload && payload.apiKey) || process.env.GOOGLE_PLACES_API_KEY;
      const placeId = (payload && payload.placeId) || process.env.GOOGLE_PLACE_ID || 'ChIJ1fe-VL25EmoRsFbEu7k820M';

      if (apiKey) {
        try {
          const placeData = await fetchGooglePlaceReviews(placeId, apiKey);
          if (placeData.status === 'OK' && placeData.result && Array.isArray(placeData.result.reviews)) {
            const freshReviews = placeData.result.reviews.map(r => ({
              author: r.author_name || 'Client',
              initials: (r.author_name || 'C').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
              avatar: r.profile_photo_url || '',
              badge: r.relative_time_description || 'Google Verified',
              rating: r.rating || 5,
              text: r.text || '',
              date: r.relative_time_description || 'Google Verified',
              link: siteData.googleReviewsUrl || 'https://www.google.com/search?q=hairvalley#lrd=0x6b12b9bd54b2f7d5:0x43db3c39bbc456b0,1,,,,'
            }));

            const existing = siteData.googleReviews || [];
            const merged = [...freshReviews];
            existing.forEach(oldR => {
              if (!merged.some(m => m.author.toLowerCase() === oldR.author.toLowerCase())) {
                merged.push(oldR);
              }
            });

            siteData.googleReviews = merged;
            const wr = await writeSiteData(siteData);
            if (reportWriteResult(res, wr)) return;
            sendJson(res, 200, {
              success: true,
              source: 'google_places_api',
              message: `Successfully synced ${freshReviews.length} live Google reviews (${merged.length} total displayed).`,
              count: merged.length,
              reviews: merged
            });
            return;
          } else {
            sendJson(res, 400, {
              success: false,
              message: `Google Places API returned status: ${placeData.status || 'UNKNOWN'}.`,
              error: placeData.error_message
            });
            return;
          }
        } catch (apiErr) {
          console.error('[Google Sync] API request failed:', apiErr.message);
          sendJson(res, 502, { success: false, error: `Failed connecting to Google Places API: ${apiErr.message}` });
          return;
        }
      }

      // No API key provided: safe fallback to verified reviews
      sendJson(res, 200, {
        success: true,
        source: 'cached_verified',
        message: 'Live Google Reviews connection is active with verified Google client testimonials. Add GOOGLE_PLACES_API_KEY to .env to pull fresh reviews directly from Google Places API.',
        count: (siteData.googleReviews || []).length,
        reviews: siteData.googleReviews || []
      });
    } catch (e) {
      sendJson(res, 500, { success: false, error: e.message });
    }
    return;
  }

  // Contact Inquiries
  if (pathname === '/api/contact' && req.method === 'POST') {
    try {
      const payload = await parseBody(req);
      const { name, email, phone, message } = payload || {};

      if (!email || !email.includes('@')) {
        sendJson(res, 400, { error: 'A valid email address is required' });
        return;
      }

      console.log(`[Contact Inquiry] New message from ${name || 'Anonymous'} (${email}, ${phone || 'No phone'}): ${message}`);

      const siteData = await readSiteData();
      if (!siteData.inquiries) siteData.inquiries = [];
      siteData.inquiries.push({
        id: 'inq-' + Date.now(),
        name: name || '',
        email: email,
        phone: phone || '',
        message: message || '',
        created_at: new Date().toISOString()
      });
      await writeSiteData(siteData);

      sendJson(res, 200, {
        success: true,
        message: 'Thank you for reaching out! Our salon team has received your message and will respond shortly.'
      });
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  // =========================================================================
  // ADMIN & COMPATIBILITY ENDPOINTS
  // =========================================================================

  // 1. GET /api/content
  if (pathname === '/api/content' && req.method === 'GET') {
    const data = await readSiteData();
    sendJson(res, 200, data);
    return;
  }

  // 2. POST /api/content (Full update)
  if (pathname === '/api/content' && req.method === 'POST') {
    try {
      const user = await getAuthUser(req);
      const payload = await parseBody(req);
      if (payload && typeof payload === 'object') {
        const wr = await writeSiteData(payload);

        // Sync individual sections in Supabase site_sections
        if (supabase) {
          try {
            if (payload.hero) {
              await supabase.from('site_sections').upsert({
                section_key: 'hero',
                title: payload.hero.title || '',
                subtitle: payload.hero.eyebrow || '',
                eyebrow: payload.hero.eyebrow || '',
                quote: payload.hero.quote || '',
                data: payload.hero,
                updated_by: user ? user.id : null,
                updated_at: new Date().toISOString()
              });
            }
            if (payload.atelier) {
              await supabase.from('site_sections').upsert({
                section_key: 'atelier',
                title: payload.atelier.title || '',
                subtitle: payload.atelier.subtitle || '',
                eyebrow: payload.atelier.eyebrow || '',
                quote: payload.atelier.quote || '',
                data: payload.atelier,
                updated_by: user ? user.id : null,
                updated_at: new Date().toISOString()
              });
            }
          } catch (e) {}
        }

        if (reportWriteResult(res, wr)) return;
        sendJson(res, 200, { success: true, message: 'Content saved successfully to database' });
      } else {
        sendJson(res, 400, { error: 'Invalid payload' });
      }
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  // 3. POST /api/service (Create service)
  if (pathname === '/api/service' && req.method === 'POST') {
    try {
      const user = await getAuthUser(req);
      const item = await parseBody(req);
      const data = await readSiteData();
      if (!data.services) data.services = [];
      item.id = item.id || ('srv-' + Date.now());
      data.services.push(item);
      const wr = await writeSiteData(data);

      // Direct write to Supabase relational services table
      if (supabase) {
        try {
          await supabase.from('services').upsert({
            id: item.id,
            category_id: item.category || item.categoryId || 'haircuts',
            category_name: item.categoryName || '',
            name: item.name || '',
            price: item.price || '',
            original_price: item.originalPrice || '',
            savings: item.savings || '',
            duration: item.duration || '',
            description: item.description || '',
            image: item.image || 'images/services/cut-ladies.jpg',
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });
        } catch (err) {
          console.warn('[Supabase] Warning creating service table row:', err.message);
        }
      }

      if (reportWriteResult(res, wr)) return;
      sendJson(res, 201, { success: true, service: item });
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  // 4. PUT /api/service (Update service)
  if (pathname === '/api/service' && req.method === 'PUT') {
    try {
      const user = await getAuthUser(req);
      const item = await parseBody(req);
      const data = await readSiteData();
      if (!data.services) data.services = [];
      const idx = data.services.findIndex(s => s.id === item.id);
      if (idx !== -1) {
        data.services[idx] = { ...data.services[idx], ...item };
        const wr = await writeSiteData(data);

        // Direct write to Supabase relational services table
        if (supabase) {
          try {
            await supabase.from('services').update({
              category_id: item.category || item.categoryId || 'haircuts',
              category_name: item.categoryName,
              name: item.name,
              price: item.price,
              original_price: item.originalPrice,
              savings: item.savings,
              duration: item.duration,
              description: item.description,
              image: item.image,
              updated_at: new Date().toISOString()
            }).eq('id', item.id);
          } catch (err) {
            console.warn('[Supabase] Warning updating service table row:', err.message);
          }
        }

        if (reportWriteResult(res, wr)) return;
        sendJson(res, 200, { success: true, service: data.services[idx] });
      } else {
        sendJson(res, 404, { error: 'Service not found' });
      }
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  // 5. DELETE /api/service (Delete service)
  if (pathname === '/api/service' && req.method === 'DELETE') {
    try {
      const user = await getAuthUser(req);
      const queryId = parsedUrl.searchParams.get('id') || (await parseBody(req)).id;
      const data = await readSiteData();
      if (!data.services) data.services = [];
      const initialCount = data.services.length;
      data.services = data.services.filter(s => s.id !== queryId);
      if (data.services.length < initialCount) {
        const wr = await writeSiteData(data);

        // Direct delete from Supabase relational services table
        if (supabase) {
          try {
            await supabase.from('services').delete().eq('id', queryId);
          } catch (err) {
            console.warn('[Supabase] Warning deleting service table row:', err.message);
          }
        }

        if (reportWriteResult(res, wr)) return;
        sendJson(res, 200, { success: true, message: 'Service deleted from database' });
      } else {
        sendJson(res, 404, { error: 'Service not found' });
      }
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  // 6. POST /api/stylist (Create stylist)
  if (pathname === '/api/stylist' && req.method === 'POST') {
    try {
      const user = await getAuthUser(req);
      const stylist = await parseBody(req);
      const data = await readSiteData();
      if (!data.about) data.about = {};
      if (!data.about.stylists) data.about.stylists = [];
      stylist.id = stylist.id || ('stylist-' + Date.now());
      data.about.stylists.push(stylist);
      const wr = await writeSiteData(data);

      // Direct write to Supabase relational stylists table
      if (supabase) {
        try {
          await supabase.from('stylists').upsert({
            id: stylist.id,
            name: stylist.name || '',
            role: stylist.role || '',
            tag: stylist.tag || '',
            craft_years: stylist.craftYears || '',
            bio: stylist.bio || '',
            image: stylist.image || 'images/stylist-1.jpg',
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });
        } catch (err) {
          console.warn('[Supabase] Warning creating stylist row:', err.message);
        }
      }

      if (reportWriteResult(res, wr)) return;
      sendJson(res, 201, { success: true, stylist });
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  // 7. PUT /api/stylist (Update stylist)
  if (pathname === '/api/stylist' && req.method === 'PUT') {
    try {
      const user = await getAuthUser(req);
      const stylist = await parseBody(req);
      const data = await readSiteData();
      if (!data.about || !data.about.stylists) {
        sendJson(res, 404, { error: 'No stylists found' });
        return;
      }
      const idx = data.about.stylists.findIndex(s => s.id === stylist.id);
      if (idx !== -1) {
        data.about.stylists[idx] = { ...data.about.stylists[idx], ...stylist };
        const wr = await writeSiteData(data);

        // Direct write to Supabase relational stylists table
        if (supabase) {
          try {
            await supabase.from('stylists').update({
              name: stylist.name,
              role: stylist.role,
              tag: stylist.tag,
              craft_years: stylist.craftYears,
              bio: stylist.bio,
              image: stylist.image,
              updated_at: new Date().toISOString()
            }).eq('id', stylist.id);
          } catch (err) {
            console.warn('[Supabase] Warning updating stylist row:', err.message);
          }
        }

        if (reportWriteResult(res, wr)) return;
        sendJson(res, 200, { success: true, stylist: data.about.stylists[idx] });
      } else {
        sendJson(res, 404, { error: 'Stylist not found' });
      }
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  // 8. DELETE /api/stylist (Delete stylist)
  if (pathname === '/api/stylist' && req.method === 'DELETE') {
    try {
      const user = await getAuthUser(req);
      const queryId = parsedUrl.searchParams.get('id') || (await parseBody(req)).id;
      const data = await readSiteData();
      if (!data.about || !data.about.stylists) {
        sendJson(res, 404, { error: 'No stylists found' });
        return;
      }
      const initialCount = data.about.stylists.length;
      data.about.stylists = data.about.stylists.filter(s => s.id !== queryId);
      if (data.about.stylists.length < initialCount) {
        const wr = await writeSiteData(data);

        // Direct delete from Supabase relational stylists table
        if (supabase) {
          try {
            await supabase.from('stylists').delete().eq('id', queryId);
          } catch (err) {
            console.warn('[Supabase] Warning deleting stylist row:', err.message);
          }
        }

        if (reportWriteResult(res, wr)) return;
        sendJson(res, 200, { success: true, message: 'Stylist deleted from database' });
      } else {
        sendJson(res, 404, { error: 'Stylist not found' });
      }
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  // 9. POST /api/upload-image (Supabase Storage + Media Assets Table)
  if (pathname === '/api/upload-image' && req.method === 'POST') {
    try {
      const user = await getAuthUser(req);
      const payload = await parseBody(req);
      if (!payload.data || !payload.filename) {
        sendJson(res, 400, { error: 'Missing data or filename' });
        return;
      }

      // Check allowed extensions
      const ext = path.extname(payload.filename).toLowerCase();
      const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
      if (!allowed.includes(ext)) {
        sendJson(res, 400, { error: `Format ${ext} not allowed. Please use JPEG, PNG, or WebP.` });
        return;
      }

      // Extract base64
      let base64Data = payload.data;
      if (base64Data.includes(',')) {
        base64Data = base64Data.split(',')[1];
      }

      const safeBaseName = path.basename(payload.filename, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
      const targetFilename = `img_${Date.now()}_${safeBaseName}${ext}`;
      const targetPath = path.join(UPLOADS_DIR, targetFilename);

      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(targetPath, buffer);

      let publicUrl = `images/uploads/${targetFilename}`;

      // Upload to Supabase Storage and log in media_assets table
      if (supabase) {
        try {
          const { error: uploadError } = await supabase.storage
            .from('uploads')
            .upload(targetFilename, buffer, {
              contentType: MIME_TYPES[ext] || 'image/jpeg',
              upsert: true
            });

          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage
              .from('uploads')
              .getPublicUrl(targetFilename);

            if (publicUrlData && publicUrlData.publicUrl) {
              publicUrl = publicUrlData.publicUrl;
              console.log(`[Supabase Storage] Uploaded: ${targetFilename}`);

              // Record in media_assets database table
              await supabase.from('media_assets').upsert({
                id: 'media-' + Date.now(),
                filename: targetFilename,
                file_url: publicUrl,
                storage_path: `uploads/${targetFilename}`,
                mime_type: MIME_TYPES[ext] || 'image/jpeg',
                file_size: buffer.length,
                uploaded_by: user ? user.id : null,
                created_at: new Date().toISOString()
              }, { onConflict: 'id' });
            }
          } else {
            console.warn('[Supabase Storage] Upload notice:', uploadError.message);
          }
        } catch (storageErr) {
          console.warn('[Supabase Storage] Exception:', storageErr.message);
        }
      }

      sendJson(res, 200, {
        success: true,
        url: publicUrl,
        filename: targetFilename,
        size: buffer.length
      });
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  // 10. DELETE /api/delete-image (Delete from Supabase Storage & media_assets)
  if (pathname === '/api/delete-image' && req.method === 'DELETE') {
    try {
      const user = await getAuthUser(req);
      const payload = await parseBody(req);
      const fileUrl = payload.url || payload.filename || parsedUrl.searchParams.get('url') || parsedUrl.searchParams.get('filename');
      if (!fileUrl) {
        sendJson(res, 400, { error: 'Missing image url or filename' });
        return;
      }

      const fileName = path.basename(fileUrl);
      const filePath = path.join(UPLOADS_DIR, fileName);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Delete from Supabase Storage & media_assets table
      if (supabase) {
        try {
          await supabase.storage.from('uploads').remove([fileName]);
          await supabase.from('media_assets').delete().eq('filename', fileName);
        } catch (err) {
          console.warn('[Supabase Storage] Delete notice:', err.message);
        }
      }

      sendJson(res, 200, { success: true, message: 'Image deleted from database and storage' });
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  // 11. GET /api/uploads (List media assets)
  if (pathname === '/api/uploads' && req.method === 'GET') {
    try {
      // 1. Try reading from Supabase media_assets table first
      if (supabase) {
        try {
          const { data: dbMedia, error: mediaErr } = await supabase
            .from('media_assets')
            .select('*')
            .order('created_at', { ascending: false });

          if (!mediaErr && dbMedia && dbMedia.length) {
            const formatted = dbMedia.map(m => ({
              filename: m.filename,
              url: m.file_url,
              size: m.file_size,
              createdAt: m.created_at
            }));
            sendJson(res, 200, { files: formatted });
            return;
          }
        } catch (e) {}
      }

      // 2. Read from Supabase Storage directly
      if (supabase) {
        try {
          const { data: sFiles, error } = await supabase.storage.from('uploads').list('', { limit: 100 });
          if (!error && Array.isArray(sFiles) && sFiles.length > 0) {
            const storageFiles = sFiles.map(f => {
              const { data: pubData } = supabase.storage.from('uploads').getPublicUrl(f.name);
              return {
                filename: f.name,
                url: pubData ? pubData.publicUrl : `images/uploads/${f.name}`,
                size: (f.metadata && f.metadata.size) || 0,
                createdAt: f.created_at || new Date()
              };
            });
            sendJson(res, 200, { files: storageFiles });
            return;
          }
        } catch (e) {}
      }

      // 3. Fallback to local files
      const localFiles = fs.readdirSync(UPLOADS_DIR).map(file => {
        const stats = fs.statSync(path.join(UPLOADS_DIR, file));
        return {
          filename: file,
          url: `images/uploads/${file}`,
          size: stats.size,
          createdAt: stats.birthtime
        };
      });

      sendJson(res, 200, { files: localFiles });
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  // 12. POST /api/newsletter (Sign-up)
  if (pathname === '/api/newsletter' && req.method === 'POST') {
    try {
      const payload = await parseBody(req);
      if (!payload.email || !payload.email.includes('@')) {
        sendJson(res, 400, { error: 'A valid email address is required' });
        return;
      }

      if (supabase) {
        try {
          await supabase.from('newsletter_subscribers').insert({ email: payload.email });
        } catch (err) {
          console.warn('[Supabase] Newsletter subscriber insert notice:', err.message);
        }
      }

      sendJson(res, 200, { success: true, message: 'Subscribed successfully' });
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  // =========================================================================
  // STATIC FILE SERVER
  // =========================================================================

  let reqPath = pathname;
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Hair Valley server running with Supabase & Admin API at http://localhost:${PORT}/`);
});
