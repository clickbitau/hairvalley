// One-off: composite the stylist's face (from client img/generated-hero-treatment.jpg)
// onto images/hero-treatment.jpg so the off-frame stylist at the left edge has a face.
// Regenerates images/hero-treatment.jpg from client img/generated-hero-treatment-left.jpg.
const path = require('path');
const Jimp = require('jimp');

const ROOT = path.join(__dirname, '..');
const BASE = path.join(ROOT, 'client img', 'generated-hero-treatment-left.jpg');
const DONOR = path.join(ROOT, 'client img', 'generated-hero-treatment.jpg');
const OUT = path.join(ROOT, 'images', 'hero-treatment.jpg');

// Donor crop: stylist head at top-right of generated-hero-treatment.jpg (1376x768)
const CROP = { x: 1252, y: 0, w: 124, h: 218 };
// Target width after horizontal flip (height scales proportionally)
const HEAD_W = 168;
// Paste position on the hero canvas (flushed to the left edge)
const PASTE = { x: 0, y: 8 };
// Alpha feather (px): soften edges so the head melts into the background.
const FEATHER = { left: 0, top: 34, right: 52, bottom: 64 };

async function main() {
  const [base, donor] = await Promise.all([Jimp.read(BASE), Jimp.read(DONOR)]);

  const head = donor.clone().crop(CROP.x, CROP.y, CROP.w, CROP.h);
  head.flip(true, false); // face right toward the client
  head.resize(HEAD_W, Jimp.AUTO);

  const { width: w, height: h } = head.bitmap;
  head.scan(0, 0, w, h, function (x, y, idx) {
    let a = 1;
    if (FEATHER.left && x < FEATHER.left) a = Math.min(a, x / FEATHER.left);
    if (FEATHER.right && x > w - FEATHER.right) a = Math.min(a, (w - x) / FEATHER.right);
    if (FEATHER.top && y < FEATHER.top) a = Math.min(a, y / FEATHER.top);
    if (FEATHER.bottom && y > h - FEATHER.bottom) a = Math.min(a, (h - y) / FEATHER.bottom);
    this.bitmap.data[idx + 3] = Math.round(this.bitmap.data[idx + 3] * Math.max(0, a));
  });

  base.composite(head, PASTE.x, PASTE.y);
  await base.writeAsync(OUT);
  console.log(`Wrote ${OUT} (${w}x${h} head pasted at ${PASTE.x},${PASTE.y})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
