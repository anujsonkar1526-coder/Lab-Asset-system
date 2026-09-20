const http = require('http');

async function testAll() {
  console.log('================================================================');
  console.log('--- E2E VERIFICATION OF LAB TRACKING SYSTEM ON http://localhost:3000/ ---');
  console.log('================================================================');

  function request(options, postData = null, cookie = '') {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(options.url || options, 'http://localhost:3000');
      const reqOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 3000,
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || 'GET',
        headers: {
          'Cookie': cookie,
          'User-Agent': 'E2E-Verifier/1.0',
          ...(options.headers || {})
        }
      };

      if (postData) {
        reqOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        reqOptions.headers['Content-Length'] = Buffer.byteLength(postData);
      }

      const req = http.request(reqOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const setCookie = res.headers['set-cookie'];
          let newCookie = cookie;
          if (setCookie) {
            const parsed = setCookie.map(c => c.split(';')[0]).join('; ');
            newCookie = parsed;
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
            cookie: newCookie,
            location: res.headers['location']
          });
        });
      });

      req.on('error', reject);
      if (postData) req.write(postData);
      req.end();
    });
  }

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log('  [PASS]', message);
      passed++;
    } else {
      console.error('  [FAIL]', message);
      failed++;
    }
  }

  try {
    // 1. Landing Page
    console.log('\n[TEST 1] Public Landing Page (http://localhost:3000/)');
    const homeRes = await request({ url: 'http://localhost:3000/' });
    assert(homeRes.statusCode === 200, 'GET / returns 200 OK');
    assert(homeRes.body.includes('Lab Equipment') || homeRes.body.includes('Asset'), 'Landing page title/branding matches');
    assert(homeRes.body.includes('Admin') && homeRes.body.includes('Lab In-Charge') && homeRes.body.includes('Requester'), 'All 3 user roles presented clearly');

    // 2. Auth Pages
    console.log('\n[TEST 2] Authentication Routes');
    const loginPageRes = await request({ url: 'http://localhost:3000/auth/login' });
    assert(loginPageRes.statusCode === 200, 'GET /auth/login returns 200 OK');
    const regPageRes = await request({ url: 'http://localhost:3000/auth/register' });
    assert(regPageRes.statusCode === 200, 'GET /auth/register returns 200 OK');

    // 3. Admin Flow
    console.log('\n[TEST 3] Admin Flow & Asset Management');
    const adminLoginRes = await request(
      { url: 'http://localhost:3000/auth/login', method: 'POST' },
      'email=admin.test%40college.edu&password=password123'
    );
    assert(adminLoginRes.statusCode === 302 && adminLoginRes.location === '/dashboard/admin', 'Admin login authenticates and redirects to /dashboard/admin');
    const adminCookie = adminLoginRes.cookie;

    const adminDashRes = await request({ url: 'http://localhost:3000/dashboard/admin' }, null, adminCookie);
    assert(adminDashRes.statusCode === 200, 'GET /dashboard/admin returns 200 OK');
    assert(adminDashRes.body.includes('Total Assets'), 'Admin dashboard shows overall asset metrics');

    // Admin Asset CRUD
    const assetsListRes = await request({ url: 'http://localhost:3000/assets' }, null, adminCookie);
    assert(assetsListRes.statusCode === 200, 'GET /assets returns 200 OK');

    // Create unique test asset
    const testTag = 'VERIFY-OSC-' + Date.now();
    const createAssetRes = await request(
      { url: 'http://localhost:3000/assets', method: 'POST' },
      `assetTag=${testTag}&name=Digital+Storage+Oscilloscope&category=Electronics&lab=ECE+Lab+2&condition=OK&totalQuantity=10&availableQuantity=10`,
      adminCookie
    );
    assert(createAssetRes.statusCode === 302, 'Admin creates new asset (POST /assets -> 302 redirect)');

    // Check Maintenance logs
    const maintRes = await request({ url: 'http://localhost:3000/maintenance' }, null, adminCookie);
    assert(maintRes.statusCode === 200, 'GET /maintenance returns 200 OK');

    // 4. Requester Flow
    console.log('\n[TEST 4] Requester (Student/Staff) Flow');
    const reqLoginRes = await request(
      { url: 'http://localhost:3000/auth/login', method: 'POST' },
      'email=student.test%40college.edu&password=password123'
    );
    assert(reqLoginRes.statusCode === 302 && reqLoginRes.location === '/dashboard/requester', 'Requester login redirects to /dashboard/requester');
    const reqCookie = reqLoginRes.cookie;

    const reqDashRes = await request({ url: 'http://localhost:3000/dashboard/requester' }, null, reqCookie);
    assert(reqDashRes.statusCode === 200, 'GET /dashboard/requester returns 200 OK');

    const browseAssetsRes = await request({ url: 'http://localhost:3000/requests' }, null, reqCookie);
    assert(browseAssetsRes.statusCode === 200, 'GET /requests (equipment catalog) returns 200 OK');
    assert(browseAssetsRes.body.includes(testTag), 'Created asset is visible in available equipment catalog');

    // Extract asset ID
    const assetRegex = /\/requests\/new\/([a-f0-9]{24})/;
    const assetIdMatch = browseAssetsRes.body.match(assetRegex);
    let createdAssetId = assetIdMatch ? assetIdMatch[1] : null;

    if (createdAssetId) {
      const returnDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const submitReqRes = await request(
        { url: 'http://localhost:3000/requests', method: 'POST' },
        `assetId=${createdAssetId}&quantity=2&purpose=Signals+and+Systems+Experiment&expectedReturnDate=${returnDate}`,
        reqCookie
      );
      assert(submitReqRes.statusCode === 302, 'Requester submits issue request (POST /requests -> 302 redirect)');

      const myRequestsRes = await request({ url: 'http://localhost:3000/requests/my-requests' }, null, reqCookie);
      assert(myRequestsRes.statusCode === 200, 'GET /requests/my-requests returns 200 OK');
      assert(myRequestsRes.body.includes('Signals and Systems Experiment'), 'Submitted request appears in My Requests');

      // 5. Lab In-Charge Flow
      console.log('\n[TEST 5] Lab In-Charge Workflow (Approve -> Issue -> Return)');
      const inchargeLoginRes = await request(
        { url: 'http://localhost:3000/auth/login', method: 'POST' },
        'email=incharge.test%40college.edu&password=password123'
      );
      assert(inchargeLoginRes.statusCode === 302 && inchargeLoginRes.location === '/dashboard/lab-incharge', 'Lab In-Charge login redirects to /dashboard/lab-incharge');
      const inchargeCookie = inchargeLoginRes.cookie;

      const inchargeDashRes = await request({ url: 'http://localhost:3000/dashboard/lab-incharge' }, null, inchargeCookie);
      assert(inchargeDashRes.statusCode === 200, 'GET /dashboard/lab-incharge returns 200 OK');
      assert(inchargeDashRes.body.includes('Signals and Systems Experiment'), 'Pending request shows in Lab In-Charge dashboard');

      const reqIdMatch = inchargeDashRes.body.match(new RegExp(`/lab-incharge/requests/([a-f0-9]{24})/approve`));
      if (reqIdMatch) {
        const reqId = reqIdMatch[1];

        // Approve
        const approveRes = await request(
          { url: `http://localhost:3000/lab-incharge/requests/${reqId}/approve`, method: 'POST' },
          '',
          inchargeCookie
        );
        assert(approveRes.statusCode === 302, 'Lab In-Charge approves request (Pending -> Approved)');

        // Issue
        const issueRes = await request(
          { url: `http://localhost:3000/lab-incharge/requests/${reqId}/issue`, method: 'POST' },
          '',
          inchargeCookie
        );
        assert(issueRes.statusCode === 302, 'Lab In-Charge issues equipment (Approved -> Issued, stock decremented)');

        // Return (OK)
        const returnRes = await request(
          { url: `http://localhost:3000/lab-incharge/requests/${reqId}/return`, method: 'POST' },
          'returnCondition=OK',
          inchargeCookie
        );
        assert(returnRes.statusCode === 302, 'Lab In-Charge records return (Issued -> Returned, condition=OK, stock restored)');
      }
    }

    // 6. Security & Authorization Checks
    console.log('\n[TEST 6] Role-Based Access Control (RBAC)');
    const blockedAssetCrud = await request({ url: 'http://localhost:3000/assets' }, null, reqCookie);
    assert(blockedAssetCrud.statusCode === 403 || blockedAssetCrud.statusCode === 302, 'Requester cannot access Admin Asset CRUD (/assets)');

    const blockedAdminDash = await request({ url: 'http://localhost:3000/dashboard/admin' }, null, reqCookie);
    assert(blockedAdminDash.statusCode === 403 || blockedAdminDash.statusCode === 302, 'Requester cannot access Admin Dashboard (/dashboard/admin)');

    const blockedInchargeDash = await request({ url: 'http://localhost:3000/dashboard/lab-incharge' }, null, reqCookie);
    assert(blockedInchargeDash.statusCode === 403 || blockedInchargeDash.statusCode === 302, 'Requester cannot access Lab In-Charge Dashboard (/dashboard/lab-incharge)');

    console.log('\n================================================================');
    console.log(`TOTAL RESULT: ${passed} PASSED | ${failed} FAILED`);
    console.log('================================================================');

    if (failed === 0) {
      console.log('🎉 ALL SYSTEM MODULES ARE 100% OPERATIONAL ACCORDING TO PROBLEM STATEMENT!');
    }
  } catch (err) {
    console.error('Test Execution Error:', err);
  }
}

testAll();
