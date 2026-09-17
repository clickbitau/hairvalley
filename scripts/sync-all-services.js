const fs = require('fs');

const FRESHA_URL = 'https://www.fresha.com/a/hairvalley-hurstville-shop-435-park-rd-hurstville-nsw-2220-vyp5k3fg/all-offer?menu=true&pId=2626895';

// 1. Update services.html remaining #book hrefs
let html = fs.readFileSync('services.html', 'utf8');
html = html.replace(/<a href="#book" class="caption" style="color: var\(--dusty-rose\); font-weight: 500;">([^<]+)<\/a>/g, 
  `<a href="${FRESHA_URL}" target="_blank" rel="noopener noreferrer" class="caption" style="color: var(--dusty-rose); font-weight: 500;">$1</a>`);
fs.writeFileSync('services.html', html, 'utf8');
console.log('Updated remaining #book links in services.html');

// 2. Add the 5 Deals from report to site-data.json
const siteData = JSON.parse(fs.readFileSync('data/site-data.json', 'utf8'));

const deals = [
  {
    id: 'deal-1',
    category: 'deals',
    categoryName: 'Weekly Deals',
    name: '$69 Scalp massage + Shampoo + Hair Treatment & Blowdry with GHD finish',
    price: 'from A$69.00',
    originalPrice: '',
    savings: 'Online Only',
    duration: '1 hr',
    description: 'Calming scalp massage, clarifying shampoo, restorative hair treatment, and blowdry with GHD styling. Online booking & payment only. Not in store.',
    image: 'images/services/deal-69.jpg'
  },
  {
    id: 'deal-2',
    category: 'deals',
    categoryName: 'Weekly Deals',
    name: '$99 for a keratin complex treatment',
    price: 'from A$99.00',
    originalPrice: '',
    savings: 'Online Only',
    duration: '1 hr',
    description: 'Keratin complex treatment at an exclusive midweek online rate. Only available through online booking & payment. Not in store.',
    image: 'images/services/deal-99.jpg'
  },
  {
    id: 'deal-3',
    category: 'deals',
    categoryName: 'Weekly Deals',
    name: '$119 for a keratin complex treatment with a style cut and blow-dry',
    price: 'from A$119.00',
    originalPrice: '',
    savings: 'Online Only',
    duration: '1 hr',
    description: 'Smoothing keratin complex with precision style cut and blowout finish. Online booking & payment only. Not in store.',
    image: 'images/services/deal-119.jpg'
  },
  {
    id: 'deal-4',
    category: 'deals',
    categoryName: 'Weekly Deals',
    name: '$139 for a keratin complex treatment with a style cut, Olaplex treatment and blow-dry',
    price: 'from A$139.00',
    originalPrice: '',
    savings: 'Online Only',
    duration: '1 hr',
    description: 'Complete keratin complex, Olaplex bond repair, style cut, and blow-dry. Online booking & payment only. Not in store.',
    image: 'images/services/deal-139.jpg'
  },
  {
    id: 'deal-5',
    category: 'deals',
    categoryName: 'Weekly Deals',
    name: 'Colour Special (Regrowth + Shampoo + Express Treatment & Dry off)',
    price: 'from A$89.10',
    originalPrice: 'A$99',
    savings: 'Save up to 10%',
    duration: '1 hr 30 mins',
    description: 'Over the shoulder length $20 surcharge. Online promotion can be acceptable for 1st time customers only. T & C apply.',
    image: 'images/services/deal-sunday.jpg'
  }
];

// Add if not already present
deals.forEach(d => {
  const exists = siteData.services.some(s => s.name === d.name);
  if (!exists) {
    siteData.services.push(d);
  }
});

fs.writeFileSync('data/site-data.json', JSON.stringify(siteData, null, 2), 'utf8');
console.log('Total services now in site-data.json:', siteData.services.length);
