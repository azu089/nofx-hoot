import { chromium } from 'playwright';

const url = 'http://localhost:3001/preview';

async function checkDashboard() {
  console.log('启动浏览器...');
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // 收集控制台日志
  const logs = [];
  page.on('console', msg => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
  });

  // 收集网络请求
  const requests = [];
  page.on('request', req => {
    if (req.url().includes('/api/')) {
      requests.push({ url: req.url(), method: req.method() });
    }
  });

  page.on('response', res => {
    if (res.url().includes('/api/')) {
      console.log(`API Response: ${res.url()} - ${res.status()}`);
    }
  });

  console.log(`打开页面: ${url}`);
  await page.goto(url, { waitUntil: 'networkidle' });

  // 等待一下让数据加载
  await page.waitForTimeout(3000);

  // 截图
  const screenshotPath = '/Users/azu/Desktop/HOOT/.playwright-mcp/dashboard-api-check.png';
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`截图保存到: ${screenshotPath}`);

  // 输出日志
  console.log('\n=== Console 日志 ===');
  logs.forEach(log => console.log(log));

  console.log('\n=== API 请求 ===');
  requests.forEach(req => console.log(`${req.method} ${req.url}`));

  // 保持浏览器打开一会儿
  await page.waitForTimeout(5000);

  await browser.close();
}

checkDashboard().catch(console.error);
