const fs = require('fs');

const data = JSON.parse(fs.readFileSync('data/site-data.json', 'utf8'));
console.log('Total services in catalog:', data.services.length);

const categories = {};
data.services.forEach(s => {
  if (!categories[s.category]) categories[s.category] = [];
  categories[s.category].push({ name: s.name, price: s.price, duration: s.duration });
});

console.log('\n--- Service Counts per Category ---');
Object.keys(categories).forEach(cat => {
  console.log(`${cat}: ${categories[cat].length} services`);
});

console.log('\n--- Sample Verification (Haircuts) ---');
categories['haircuts'].forEach(s => console.log(`• ${s.name} => ${s.price} (${s.duration})`));

console.log('\n--- Sample Verification (Deals) ---');
categories['deals'].forEach(s => console.log(`• ${s.name} => ${s.price} (${s.duration})`));

console.log('\n--- Sample Verification (Keratin) ---');
categories['keratin'].forEach(s => console.log(`• ${s.name} => ${s.price} (${s.duration})`));
