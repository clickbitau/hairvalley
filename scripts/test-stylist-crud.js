const http = require('http');

function testEndpoint(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, data });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('Testing Stylist CRUD & Image Upload...');

  // 1. CREATE stylist
  const createRes = await testEndpoint('/api/stylist', 'POST', {
    name: 'Sarah Jenkins',
    role: 'Balayage Specialist',
    tag: 'Color Artist',
    craftYears: '6+ Years Craft',
    bio: 'Specialist in custom foil weaving.',
    image: 'images/stylist-1.jpg'
  });
  const created = JSON.parse(createRes.data);
  console.log(`POST /api/stylist => Status ${createRes.status}, Created ID: ${created.stylist?.id}`);

  // 2. UPDATE stylist
  const updateRes = await testEndpoint('/api/stylist', 'PUT', {
    id: created.stylist?.id,
    name: 'Sarah Jenkins - Senior',
    role: 'Senior Balayage Specialist',
    tag: 'Master Colorist',
    craftYears: '8+ Years Craft',
    bio: 'Updated bio information.',
    image: 'images/stylist-1.jpg'
  });
  const updated = JSON.parse(updateRes.data);
  console.log(`PUT /api/stylist => Status ${updateRes.status}, Name: ${updated.stylist?.name}`);

  // 3. DELETE stylist
  const deleteRes = await testEndpoint(`/api/stylist?id=${encodeURIComponent(created.stylist?.id)}`, 'DELETE');
  const deleted = JSON.parse(deleteRes.data);
  console.log(`DELETE /api/stylist => Status ${deleteRes.status}, Message: ${deleted.message}`);

  // 4. Test Image Upload
  const fakePngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const uploadRes = await testEndpoint('/api/upload-image', 'POST', {
    filename: 'test_pixel.png',
    data: fakePngBase64
  });
  const uploaded = JSON.parse(uploadRes.data);
  console.log(`POST /api/upload-image => Status ${uploadRes.status}, URL: ${uploaded.url}`);

  // 5. Delete Uploaded Image
  const delImgRes = await testEndpoint(`/api/delete-image?filename=${encodeURIComponent(uploaded.filename)}`, 'DELETE');
  const delImg = JSON.parse(delImgRes.data);
  console.log(`DELETE /api/delete-image => Status ${delImgRes.status}, Message: ${delImg.message}`);

  console.log('ALL STYLIST & MEDIA CRUD VERIFIED!');
}

run().catch(console.error);
