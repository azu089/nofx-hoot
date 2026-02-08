'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// 签到状态
interface CheckinStatus {
  checkedInToday: boolean
  streak: number
  todayReward: string | null
  nextReward: string
}

// 签到结果
interface CheckinResult {
  success: boolean
  reward: number
  streak: number
  message: string
}

// 空投余额
interface AirdropBalance {
  totalEarned: string
  available: string
  locked: string
  vesting: string
}

// 空投历史记录
interface AirdropHistoryItem {
  id: string
  type: string
  amount: string
  status: string
  createdAt: string
  description: string
}

// 获取签到状态
export function useCheckinStatus() {
  return useQuery({
    queryKey: ['airdrop', 'checkin-status'],
    queryFn: async () => {
      const response = await api.get<CheckinStatus>('/airdrop/checkin/status')
      return response.data
    },
  })
}

// 执行签到
export function useCheckin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const response = await api.post<CheckinResult>('/airdrop/checkin', {})
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['airdrop'] })
    },
  })
}

// 获取空投余额
export function useAirdropBalance() {
  return useQuery({
    queryKey: ['airdrop', 'balance'],
    queryFn: async () => {
      const response = await api.get<AirdropBalance>('/airdrop/balance')
      return response.data
    },
  })
}

// 获取空投历史
export function useAirdropHistory() {
  return useQuery({
    queryKey: ['airdrop', 'history'],
    queryFn: async () => {
      const response = await api.get<AirdropHistoryItem[]>('/airdrop/history')
      return response.data
    },
  })
}

// ============================================================
// 任务系统
// ============================================================

// 任务状态
export type TaskStatus = 'incomplete' | 'completed' | 'repeatable'

// 任务项
export interface TaskItem {
  id: string
  label: string
  description: string
  reward: string
  rewardAmount: number
  status: TaskStatus
  claimedAmount?: string
  claimedCount?: number
  actionUrl?: string
}

// 静态备用任务列表（API 不可用时显示）
const FALLBACK_TASKS: TaskItem[] = [
  { id: 'register', label: '注册奖励', description: '注册即送', reward: '20 HOOT', rewardAmount: 20, status: 'completed' },
  { id: 'bind_tg', label: '绑定 Telegram', description: '绑定 TG 账号', reward: '10 HOOT', rewardAmount: 10, status: 'incomplete', actionUrl: '/profile' },
  { id: 'bind_wallet', label: '绑定钱包', description: '绑定 Web3 钱包', reward: '10 HOOT', rewardAmount: 10, status: 'incomplete', actionUrl: '/profile' },
  { id: 'bind_email', label: '绑定邮箱', description: '绑定并验证邮箱', reward: '10 HOOT', rewardAmount: 10, status: 'incomplete', actionUrl: '/profile' },
  { id: 'referral', label: '邀请好友', description: '首次交易后发放', reward: '15 HOOT/人', rewardAmount: 15, status: 'repeatable', claimedAmount: '0', claimedCount: 0, actionUrl: '/referral' },
  { id: 'trading_profit', label: '盈利交易', description: '盈利交易额的2倍HOOT', reward: '2x 倍数', rewardAmount: 2, status: 'repeatable', claimedAmount: '0', claimedCount: 0, actionUrl: '/trading' },
]

// 获取任务列表
export function useTaskList() {
  return useQuery({
    queryKey: ['airdrop', 'tasks'],
    queryFn: async () => {
      const response = await api.get<TaskItem[]>('/airdrop/tasks')
      return response.data
    },
    placeholderData: FALLBACK_TASKS,
    retry: 1,
  })
}

// 领取任务奖励
export function useClaimTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (taskId: string) => {
      const response = await api.post<{ success: boolean; reward: number; message: string }>(`/airdrop/tasks/${taskId}/claim`, {})
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['airdrop'] })
    },
  })
}
