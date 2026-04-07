import type { ArenaDecisionRecord } from '../../types/strategy'
import { API_BASE, httpClient } from './helpers'

export const arenaApi = {
  async getArenaRecords(traderId: string, limit = 20): Promise<{ records: ArenaDecisionRecord[] }> {
    const result = await httpClient.get<{ records: ArenaDecisionRecord[] }>(
      `${API_BASE}/arena/records/${traderId}?limit=${limit}`
    )
    if (!result.success) throw new Error('Failed to fetch arena records')
    return result.data ?? { records: [] }
  },

  async getArenaLatestRecord(
    traderId: string,
    symbol = 'BTCUSDT'
  ): Promise<ArenaDecisionRecord | null> {
    const result = await httpClient.get<ArenaDecisionRecord>(
      `${API_BASE}/arena/records/${traderId}/latest?symbol=${symbol}`
    )
    if (!result.success) return null
    return result.data ?? null
  },

  async triggerArenaRun(traderId: string, symbol?: string): Promise<void> {
    const url = symbol
      ? `${API_BASE}/arena/run/${traderId}?symbol=${symbol}`
      : `${API_BASE}/arena/run/${traderId}`
    const result = await httpClient.post(url, {})
    if (!result.success) throw new Error('Failed to trigger arena run')
  },
}
