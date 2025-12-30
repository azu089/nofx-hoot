// QuantFi 压力测试脚本 (k6)
// 使用方法: k6 run scripts/测试/压力测试.js
// 安装 k6: brew install k6 (macOS) 或 https://k6.io/docs/get-started/installation/

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// 自定义指标
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');
const apiDuration = new Trend('api_duration');

// 测试配置
export const options = {
  // 阶段配置
  stages: [
    { duration: '30s', target: 10 },   // 预热阶段：30秒内增加到10用户
    { duration: '1m', target: 50 },    // 负载阶段：1分钟内增加到50用户
    { duration: '2m', target: 50 },    // 稳定阶段：保持50用户2分钟
    { duration: '1m', target: 100 },   // 压力阶段：1分钟内增加到100用户
    { duration: '2m', target: 100 },   // 峰值阶段：保持100用户2分钟
    { duration: '30s', target: 0 },    // 恢复阶段：30秒内降到0
  ],

  // 阈值配置
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95% 请求在 2 秒内完成
    http_req_failed: ['rate<0.05'],      // 错误率低于 5%
    errors: ['rate<0.1'],                // 自定义错误率低于 10%
  },
};

// 基础配置
const BASE_URL = __ENV.API_URL || 'http://localhost:4001/api';
const TEST_USER = {
  email: 'loadtest@example.com',
  password: 'loadtest123',
};

// 设置阶段
export function setup() {
  // 创建测试用户（如果不存在）
  const registerRes = http.post(
    `${BASE_URL}/auth/register`,
    JSON.stringify({
      email: TEST_USER.email,
      password: TEST_USER.password,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  // 登录获取 token
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({
      email: TEST_USER.email,
      password: TEST_USER.password,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  const body = JSON.parse(loginRes.body);
  if (body.code === 0 && body.data.accessToken) {
    return { token: body.data.accessToken };
  }

  console.error('Setup failed: Unable to get token');
  return { token: null };
}

// 主测试函数
export default function (data) {
  const token = data.token;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: token ? `Bearer ${token}` : '',
  };

  // 1. 健康检查（无需认证）
  group('健康检查', function () {
    const res = http.get(`${BASE_URL}/health`);
    check(res, {
      '状态码 200': (r) => r.status === 200,
      '响应时间 < 500ms': (r) => r.timings.duration < 500,
    });
    errorRate.add(res.status !== 200);
  });

  sleep(0.5);

  // 2. 登录测试
  group('用户登录', function () {
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({
        email: TEST_USER.email,
        password: TEST_USER.password,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    loginDuration.add(Date.now() - start);

    const success = check(res, {
      '登录成功': (r) => {
        const body = JSON.parse(r.body);
        return body.code === 0;
      },
      '返回 token': (r) => {
        const body = JSON.parse(r.body);
        return body.data && body.data.accessToken;
      },
    });

    errorRate.add(!success);
  });

  sleep(0.5);

  // 3. 获取用户信息
  group('用户信息', function () {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/auth/me`, { headers });
    apiDuration.add(Date.now() - start);

    const success = check(res, {
      '获取成功': (r) => r.status === 200,
      '响应时间 < 1s': (r) => r.timings.duration < 1000,
    });

    errorRate.add(!success);
  });

  sleep(0.5);

  // 4. 钱包查询
  group('钱包查询', function () {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/wallets/me`, { headers });
    apiDuration.add(Date.now() - start);

    const success = check(res, {
      '查询成功': (r) => {
        const body = JSON.parse(r.body);
        return body.code === 0;
      },
    });

    errorRate.add(!success);
  });

  sleep(0.5);

  // 5. 策略列表
  group('策略列表', function () {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/strategies`, { headers });
    apiDuration.add(Date.now() - start);

    const success = check(res, {
      '查询成功': (r) => {
        const body = JSON.parse(r.body);
        return body.code === 0;
      },
    });

    errorRate.add(!success);
  });

  sleep(0.5);

  // 6. 实例列表
  group('实例列表', function () {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/instances`, { headers });
    apiDuration.add(Date.now() - start);

    const success = check(res, {
      '查询成功': (r) => {
        const body = JSON.parse(r.body);
        return body.code === 0;
      },
    });

    errorRate.add(!success);
  });

  sleep(0.5);

  // 7. GameFi 概览
  group('GameFi 概览', function () {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/gamefi/overview`, { headers });
    apiDuration.add(Date.now() - start);

    const success = check(res, {
      '查询成功': (r) => {
        const body = JSON.parse(r.body);
        return body.code === 0;
      },
    });

    errorRate.add(!success);
  });

  sleep(0.5);

  // 8. 计费日志
  group('计费日志', function () {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/billing/logs`, { headers });
    apiDuration.add(Date.now() - start);

    const success = check(res, {
      '查询成功': (r) => {
        const body = JSON.parse(r.body);
        return body.code === 0;
      },
    });

    errorRate.add(!success);
  });

  sleep(1);
}

// 清理阶段
export function teardown(data) {
  console.log('压力测试完成');
}

// 结果汇总
export function handleSummary(data) {
  const summary = {
    测试时间: new Date().toISOString(),
    总请求数: data.metrics.http_reqs.values.count,
    成功率: ((1 - data.metrics.http_req_failed.values.rate) * 100).toFixed(2) + '%',
    平均响应时间: data.metrics.http_req_duration.values.avg.toFixed(2) + 'ms',
    P95响应时间: data.metrics.http_req_duration.values['p(95)'].toFixed(2) + 'ms',
    最大响应时间: data.metrics.http_req_duration.values.max.toFixed(2) + 'ms',
    每秒请求数: data.metrics.http_reqs.values.rate.toFixed(2),
  };

  console.log('\n=== 压力测试结果 ===');
  console.log(JSON.stringify(summary, null, 2));

  return {
    'scripts/测试/压力测试结果.json': JSON.stringify(summary, null, 2),
  };
}
