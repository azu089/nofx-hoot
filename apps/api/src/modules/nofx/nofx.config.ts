/**
 * nofx 接入配置（HOOT 商业核心 → nofx 交易核心）
 *
 * - baseUrl：nofx HTTP API 根地址，默认本机 8082
 * - internalToken：与 nofx 端 HOOT_INTERNAL_TOKEN 同值的服务级共享密钥
 * - timeoutMs：单次 upstream 请求超时
 *
 * 集中读取 env，避免散落各处。Service/Client 只依赖此对象。
 */
export interface NofxRuntimeConfig {
  baseUrl: string;
  internalToken: string;
  timeoutMs: number;
}

export function loadNofxConfig(): NofxRuntimeConfig {
  const baseUrl = (process.env.NOFX_BASE_URL || 'http://127.0.0.1:8082').replace(/\/$/, '');
  const internalToken = process.env.NOFX_INTERNAL_TOKEN || '';
  const timeoutMs = parseInt(process.env.NOFX_TIMEOUT_MS || '5000', 10);
  return { baseUrl, internalToken, timeoutMs };
}

export const NOFX_CONFIG = Symbol('NOFX_CONFIG');
