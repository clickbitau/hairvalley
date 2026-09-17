const fs = require('fs');

const html = fs.readFileSync('services.html', 'utf8');
const lines = html.split('\n');
console.log('Total lines in services.html:', lines.length);

const bookMatches = [];
lines.forEach((l, i) => {
  if (l.includes('href="#book"')) {
    bookMatches.push({ line: i + 1, content: l.trim() });
  }
});
console.log('Lines containing href="#book":', bookMatches.length);
bookMatches.forEach(m => console.log(m.line + ': ' + m.content));
