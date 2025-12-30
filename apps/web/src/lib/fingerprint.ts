/**
 * 设备指纹收集工具
 * 用于反作弊：收集浏览器特征生成唯一设备标识
 */

export interface FingerprintComponents {
  userAgent?: string;
  language?: string;
  platform?: string;
  timezone?: string;
  screenResolution?: string;
  colorDepth?: number;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  canvas?: string;
  webgl?: string;
  fonts?: string[];
  plugins?: string[];
  touchSupport?: boolean;
  cookiesEnabled?: boolean;
  localStorage?: boolean;
  sessionStorage?: boolean;
}

export interface DeviceFingerprint {
  hash: string;
  components: FingerprintComponents;
}

/**
 * 收集设备指纹组件
 */
async function collectComponents(): Promise<FingerprintComponents> {
  const components: FingerprintComponents = {};

  // 基础信息
  if (typeof navigator !== 'undefined') {
    components.userAgent = navigator.userAgent;
    components.language = navigator.language;
    components.platform = navigator.platform;
    components.hardwareConcurrency = navigator.hardwareConcurrency;
    components.cookiesEnabled = navigator.cookieEnabled;

    // deviceMemory 是非标准属性
    if ('deviceMemory' in navigator) {
      components.deviceMemory = (navigator as any).deviceMemory;
    }
  }

  // 时区
  try {
    components.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // 忽略错误
  }

  // 屏幕信息
  if (typeof screen !== 'undefined') {
    components.screenResolution = `${screen.width}x${screen.height}`;
    components.colorDepth = screen.colorDepth;
  }

  // 触摸支持
  components.touchSupport =
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0;

  // 存储支持
  try {
    components.localStorage = !!window.localStorage;
  } catch {
    components.localStorage = false;
  }

  try {
    components.sessionStorage = !!window.sessionStorage;
  } catch {
    components.sessionStorage = false;
  }

  // Canvas 指纹
  try {
    components.canvas = getCanvasFingerprint();
  } catch {
    // 忽略错误
  }

  // WebGL 指纹
  try {
    components.webgl = getWebGLFingerprint();
  } catch {
    // 忽略错误
  }

  return components;
}

/**
 * 获取 Canvas 指纹
 */
function getCanvasFingerprint(): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) return '';

  canvas.width = 200;
  canvas.height = 50;

  // 绘制文本
  ctx.textBaseline = 'top';
  ctx.font = "14px 'Arial'";
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#f60';
  ctx.fillRect(125, 1, 62, 20);
  ctx.fillStyle = '#069';
  ctx.fillText('QuantFi Fingerprint', 2, 15);
  ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
  ctx.fillText('QuantFi Fingerprint', 4, 17);

  // 转换为数据 URL
  const dataUrl = canvas.toDataURL();

  // 返回哈希值（简化版，取中间部分）
  return dataUrl.slice(-50);
}

/**
 * 获取 WebGL 指纹
 */
function getWebGLFingerprint(): string {
  const canvas = document.createElement('canvas');
  const gl =
    canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

  if (!gl) return '';

  const webglCtx = gl as WebGLRenderingContext;

  // 获取渲染器和厂商信息
  const debugInfo = webglCtx.getExtension('WEBGL_debug_renderer_info');
  if (!debugInfo) return '';

  const vendor = webglCtx.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
  const renderer = webglCtx.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);

  return `${vendor}~${renderer}`;
}

/**
 * 生成指纹哈希
 */
async function generateHash(components: FingerprintComponents): Promise<string> {
  const keyFeatures = [
    components.userAgent || '',
    components.platform || '',
    components.timezone || '',
    components.screenResolution || '',
    components.colorDepth?.toString() || '',
    components.hardwareConcurrency?.toString() || '',
    components.canvas || '',
    components.webgl || '',
  ].join('|');

  // 使用 Web Crypto API 生成哈希
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(keyFeatures);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return hashHex.substring(0, 32);
    } catch {
      // 回退到简单哈希
    }
  }

  // 简单哈希回退
  let hash = 0;
  for (let i = 0; i < keyFeatures.length; i++) {
    const char = keyFeatures.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(32, '0').substring(0, 32);
}

/**
 * 获取设备指纹
 * 主函数，收集所有组件并生成哈希
 */
export async function getDeviceFingerprint(): Promise<DeviceFingerprint> {
  const components = await collectComponents();
  const hash = await generateHash(components);

  return {
    hash,
    components,
  };
}

/**
 * 从本地存储获取或生成设备指纹
 * 缓存指纹以提高性能
 */
export async function getCachedFingerprint(): Promise<DeviceFingerprint> {
  const CACHE_KEY = 'qfi_device_fp';
  const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 小时

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.timestamp && Date.now() - parsed.timestamp < CACHE_EXPIRY) {
        return {
          hash: parsed.hash,
          components: parsed.components,
        };
      }
    }
  } catch {
    // 忽略缓存读取错误
  }

  // 生成新指纹
  const fingerprint = await getDeviceFingerprint();

  // 缓存
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        hash: fingerprint.hash,
        components: fingerprint.components,
        timestamp: Date.now(),
      }),
    );
  } catch {
    // 忽略缓存写入错误
  }

  return fingerprint;
}
