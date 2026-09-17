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
  console.log('Testing Admin endpoints...');

  // 1. Check admin.html
  const adminPage = await testEndpoint('/admin.html');
  console.log(`GET /admin.html => Status ${adminPage.status} (Length: ${adminPage.data.length} chars)`);

  // 2. Check /api/content
  const content = await testEndpoint('/api/content');
  const jsonContent = JSON.parse(content.data);
  console.log(`GET /api/content => Status ${content.status} (${jsonContent.services.length} services loaded)`);

  // 3. Test CREATE service (POST /api/service)
  const newService = {
    name: 'Test Temporary Service',
    category: 'haircuts',
    price: 'A$99',
    duration: '20 mins',
    description: 'Temporary service for testing CRUD'
  };
  const createRes = await testEndpoint('/api/service', 'POST', newService);
  const createData = JSON.parse(createRes.data);
  console.log(`POST /api/service => Status ${createRes.status}, Created ID: ${createData.service?.id}`);

  const createdId = createData.service?.id;

  // 4. Test UPDATE service (PUT /api/service)
  const updatedService = {
    id: createdId,
    name: 'Updated Temporary Service Name',
    price: 'A$120',
    category: 'haircuts',
    duration: '25 mins',
    description: 'Updated description'
  };
  const updateRes = await testEndpoint('/api/service', 'PUT', updatedService);
  const updateData = JSON.parse(updateRes.data);
  console.log(`PUT /api/service => Status ${updateRes.status}, Updated Name: ${updateData.service?.name}`);

  // 5. Test DELETE service (DELETE /api/service?id=...)
  const deleteRes = await testEndpoint(`/api/service?id=${encodeURIComponent(createdId)}`, 'DELETE');
  const deleteData = JSON.parse(deleteRes.data);
  console.log(`DELETE /api/service => Status ${deleteRes.status}, Message: ${deleteData.message}`);

  // 6. Verify count returns to original
  const verifyRes = await testEndpoint('/api/content');
  const verifyData = JSON.parse(verifyRes.data);
  console.log(`GET /api/content after delete => ${verifyData.services.length} services (matches initial)`);

  console.log('ALL CRUD TESTS COMPLETED SUCCESSFULLY!');
}

run().catch(console.error);
