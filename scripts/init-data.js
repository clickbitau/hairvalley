const fs = require('fs');
const path = require('path');

const html = fs.readFileSync('services.html', 'utf8');

const categoryRegex = /<section[^>]*id="([^"]+)"[^>]*class="service-category-section"[^>]*>([\s\S]*?)<\/section>/g;
const categoryTitleRegex = /<h2 class="category-title">([^<]+)<\/h2>/;
const serviceCardRegex = /<div class="service-card">([\s\S]*?)<\/div>\s*<\/div>/g;
const imgRegex = /<img src="([^"]+)"/;
const titleRegex = /<h3 class="service-card-title">([^<]+)<\/h3>/;
const priceRegex = /<span class="service-card-price">([^<]+)<\/span>/;
const originalRegex = /<span class="service-card-original">([^<]+)<\/span>/;
const savingsRegex = /<span class="service-card-savings">([^<]+)<\/span>/;
const durationRegex = /<span class="service-card-duration">([^<]+)<\/span>/;
const descRegex = /<p class="service-card-desc">([^<]+)<\/p>/;

let categories = [];
let services = [];
let catMatch;
let idCounter = 1;

while ((catMatch = categoryRegex.exec(html)) !== null) {
  const catId = catMatch[1];
  const catBody = catMatch[2];
  const titleMatch = categoryTitleRegex.exec(catBody);
  const catTitle = titleMatch ? titleMatch[1].trim() : catId;
  categories.push({ id: catId, title: catTitle });

  const cardRegex = /<div class="glass-card--light">([\s\S]*?)<\/div>\s*<\/div>/g;
  let cardMatch;
  while ((cardMatch = cardRegex.exec(catBody)) !== null) {
    const cardHtml = cardMatch[1];
    const tMatch = /<h3 class="heading-card">([^<]+)<\/h3>/.exec(cardHtml);
    const pMatch = /<span class="price-val">([^<]+)<\/span>/.exec(cardHtml);
    if (tMatch && pMatch) {
      const iMatch = /<img src="([^"]+)"/.exec(cardHtml);
      const oMatch = /<span class="price-original">([^<]+)<\/span>/.exec(cardHtml);
      const sMatch = /<span class="price-savings">([^<]+)<\/span>/.exec(cardHtml);
      const dMatch = /<span class="meta-duration"[^>]*>([^<]+)<\/span>/.exec(cardHtml);
      const descM = /<p class="body-sm"[^>]*>([\s\S]*?)<\/p>/.exec(cardHtml);

      services.push({
        id: 'srv-' + (idCounter++),
        category: catId,
        categoryName: catTitle,
        name: tMatch[1].trim(),
        price: pMatch[1].trim(),
        originalPrice: oMatch ? oMatch[1].trim() : '',
        savings: sMatch ? sMatch[1].trim() : '',
        duration: dMatch ? dMatch[1].trim() : '',
        description: descM ? descM[1].replace(/\s+/g, ' ').trim() : '',
        image: iMatch ? iMatch[1].trim() : 'images/services/color-root.jpg'
      });
    }
  }
}

console.log('Categories parsed:', categories.length);
console.log('Services parsed:', services.length);

const siteData = {
  hero: {
    eyebrow: 'Hurstville Atelier · Sydney',
    title: 'Hair that moves the way you actually live.',
    quote: 'Precision cutting, bespoke colour correction, and peptide molecular restoration. Hair health isn\'t a step before the style — it is the style.',
    startingPrice: 'A$40.50',
    rating: '5.0',
    reviewCount: '610',
    backgroundImage: 'images/hero-lying.jpg'
  },
  atelier: {
    eyebrow: 'Signature Atelier Craft',
    title: 'Inside the Hurstville Atelier.',
    subtitle: 'Where tailored sensory diagnosis meets peptide restoration. Step through our atelier mirror.',
    quote: 'Precision cutting, bespoke colour correction, and restorative peptide care formulated for hair integrity.',
    archModelImage: 'images/hero.jpg',
    startingPrice: 'A$40.50',
    stats: {
      years: '12+',
      stylists: '8+',
      reviews: '610+'
    }
  },
  featuredHero: {
    title: 'Brazilian Keratin',
    tag: 'Salon Favourite',
    price: 'from A$162',
    originalPrice: 'A$180',
    savings: 'save up to 10%',
    duration: '2 hrs',
    description: 'Smooths cuticle porosity and rebuilds from the inside out with bio-active amino acids. Book before Wednesday for the exclusive online promotional rate.',
    image: 'images/service-keratin.jpg'
  },
  promos: [
    {
      id: 'promo-1',
      title: 'Wednesday Colour Revival',
      discount: '10% OFF',
      terms: 'Full Head Balayage & All Chemical Lightening Services',
      tag: 'Online Bookings Only',
      duration: 'Valid Mon & Wed'
    },
    {
      id: 'promo-2',
      title: 'Scalp Detox & Mask Ritual',
      discount: 'A$19.95',
      terms: 'Complimentary Detoxing Scalp Massage with every Stylecut',
      tag: 'First-time Clients',
      duration: 'All Week'
    }
  ],
  about: {
    credoEyebrow: 'Our Craft & Conviction',
    pullQuote: '“Hair health isn\'t a step before the style. It\'s the style.”',
    heroImage: 'images/about-hero.jpg',
    credoTitle: 'Diagnosis before prescription. Respect before speed.',
    credoBody: 'We opened Hair Valley in Hurstville with an uncompromising point of view: hair color and structural texture must never come at the expense of hair shaft integrity. Over the past 12 years and across more than 100,000 client consultations, we have developed our salon around diagnosis rather than blanket packages.',
    rituals: [
      {
        id: 'ritual-1',
        name: 'The Basin Experience',
        movement: 'First Movement',
        duration: '15 min · Detoxing Massage',
        description: 'Lukewarm purified water and botanically derived clarifying cleansers. A methodical 15-minute detoxing scalp massage stimulates microcirculation while relieving tension in the neck and temples.',
        image: 'images/ritual-wash.jpg'
      },
      {
        id: 'ritual-2',
        name: 'Molecular Restoration',
        movement: 'Second Movement',
        duration: '10 min · Japanese Mask & K18',
        description: 'Targeted peptide formulations and concentrated Japanese hair masks. K18 bio-mimetic peptides reconnect broken keratin chains, reversing structural damage from bleach and thermal styling.',
        image: 'images/ritual-mask.jpg'
      },
      {
        id: 'ritual-3',
        name: 'The Tactile Finish',
        movement: 'Closing Movement',
        duration: 'Bespoke Styling & GHD Finish',
        description: 'The closing movement pairs precision blow waving with low-heat ceramic detailing. Using GHD tools and weightless leave-in oils, we create fluid, touchable volume that moves naturally.',
        image: 'images/ritual-finish.jpg'
      }
    ],
    stylists: [
      {
        id: 'stylist-1',
        name: 'Martina',
        role: 'Colour & Balayage Specialist',
        tag: 'Lead Color Master',
        craftYears: '12+ Years Craft',
        bio: 'Renowned across Sydney for bespoke dimensional blonding, gentle foil micro-weaving, and corrective shade balance that protects hair density and root health.',
        image: 'images/stylist-1.jpg'
      },
      {
        id: 'stylist-2',
        name: 'Cathy',
        role: 'Texture & Keratin Rebuilding',
        tag: 'Texture Master',
        craftYears: '10+ Years Craft',
        bio: 'Expert in Brazilian Keratin, permanent Japanese straightening, and amino nanoplasty.',
        image: 'images/stylist-2.jpg'
      },
      {
        id: 'stylist-3',
        name: 'Aj',
        role: 'Precision Cutting & Architecture',
        tag: 'Architecture',
        craftYears: '9+ Years Craft',
        bio: 'Tailored perimeter cuts, internal weight management, and transformative re-style cuts.',
        image: 'images/stylist-3.jpg'
      },
      {
        id: 'stylist-4',
        name: 'Roni',
        role: 'Sensory Scalp Rituals & Styling',
        tag: 'Sensory Care',
        craftYears: '8+ Years Craft',
        bio: 'Master of detoxing basin massage, GHD thermal wave finishing, and extension care.',
        image: 'images/stylist-4.jpg'
      }
    ]
  },
  contact: {
    hurstville: {
      name: 'Hurstville Salon',
      address: 'Shop 435, 3 Cross Street, Hurstville NSW 2220',
      landmark: 'Opposite Westfield / Station',
      phone: '02 9580 0000'
    },
    leppington: {
      name: 'Leppington Branch',
      address: 'Private Atelier Studio',
      instructions: 'By Appointment / SMS only',
      sms: '0420 000 000'
    },
    hours: {
      standard: 'Mon – Wed & Fri – Sat: 9:30 am – 6:00 pm',
      thursday: 'Thursday: 9:30 am – 9:00 pm (Late Night)',
      sunday: 'Sunday: 10:00 am – 6:00 pm'
    },
    bookingDeposit: 'A$50 deposit secures online bookings.',
    socials: {
      instagram: 'https://instagram.com',
      facebook: 'https://facebook.com'
    }
  },
  categories: categories,
  services: services
};

fs.writeFileSync('data/site-data.json', JSON.stringify(siteData, null, 2), 'utf8');
console.log('Saved data/site-data.json successfully! Bytes:', fs.statSync('data/site-data.json').size);
