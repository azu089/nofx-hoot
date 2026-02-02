'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Key, Plus, Trash2, Eye, EyeOff, CheckCircle, AlertCircle, ExternalLink, Copy, Check, X, AlertTriangle, Edit, Loader2, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// 后端 API 响应类型
interface ApiKeyResponse {
  id: string
  exchange: string
  label: string
  maskedKey: string
  isActive: boolean
  createdAt: string
}

// 支持的交易所（与后端一致：binance, okx, bybit）
const supportedExchanges = [
  { id: 'binance', name: 'Binance', logo: '/icons/exchanges/币安.webp', guideUrl: 'https://www.binance.com/api-management' },
  { id: 'okx', name: 'OKX', logo: '/icons/exchanges/okx.webp', guideUrl: 'https://www.okx.com/account/my-api' },
  { id: 'bybit', name: 'Bybit', logo: '/icons/exchanges/bybit.webp', guideUrl: 'https://www.bybit.com/app/user/api-management' },
]

// 获取交易所 logo
const getExchangeLogo = (exchange: string) => {
  const found = supportedExchanges.find(e => e.id === exchange)
  return found?.logo || '/icons/exchanges/default.webp'
}

// 获取交易所名称
const getExchangeName = (exchange: string) => {
  const found = supportedExchanges.find(e => e.id === exchange)
  return found?.name || exchange
}

export function ApiKeysPage() {
  const queryClient = useQueryClient()
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedExchange, setSelectedExchange] = useState<string | null>(null)
  const [selectedApiKey, setSelectedApiKey] = useState<ApiKeyResponse | null>(null)
  const [showSecret, setShowSecret] = useState(false)
  const [copied, setCopied] = useState(false)

  // 获取 API Key 列表（与 wallet-page-v3 统一数据结构）
  const { data: apiKeysData, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const response = await api.get<{ items: ApiKeyResponse[]; total: number }>('/api-keys')
      return response.data?.items || []
    },
  })

  const boundApiKeys = apiKeysData || []

  // 为每个 API Key 获取余额（现货+合约）
  const apiKeyBalanceQueries = useQueries({
    queries: boundApiKeys.map((key: ApiKeyResponse) => ({
      queryKey: ['api-key-balance', key.id],
      queryFn: async () => {
        try {
          const response = await api.get<{
            valid: boolean
            totalUsdValue: number
            spotValue: number
            futuresValue: number
            permissions: string[]
            error?: string
          }>(`/api-keys/${key.id}/verify`)
          return response.data
        } catch {
          return { valid: false, totalUsdValue: 0, spotValue: 0, futuresValue: 0, permissions: [], error: '网络错误' }
        }
      },
      enabled: !!key.id,
      staleTime: 30 * 1000, // 30秒缓存（更快刷新）
      refetchOnWindowFocus: true,
    })),
  })

  // 创建 API Key
  const createMutation = useMutation({
    mutationFn: async (data: { exchange: string; label: string; apiKey: string; apiSecret: string }) => {
      const response = await api.post('/api-keys', data)
      return response.data
    },
    onSuccess: () => {
      toast.success('API Key 添加成功')
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      setShowAddModal(false)
      setSelectedExchange(null)
      setFormData({ apiKey: '', secretKey: '', passphrase: '', label: '' })
    },
    onError: (error: Error) => {
      toast.error(error.message || '添加失败')
    },
  })

  // 删除 API Key
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api-keys/${id}`)
      return id
    },
    onSuccess: (deletedId) => {
      // 立即从缓存中移除，不等待 refetch
      queryClient.setQueryData(['api-keys'], (oldData: { items: ApiKeyResponse[]; total: number } | undefined) => {
        if (!oldData) return { items: [], total: 0 }
        return {
          items: oldData.items.filter((key) => key.id !== deletedId),
          total: oldData.total - 1,
        }
      })
      // 移除对应的余额缓存
      queryClient.removeQueries({ queryKey: ['api-key-balance', deletedId] })
      // 然后重新获取确保数据同步
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      toast.success('API Key 已删除')
      setShowDeleteModal(false)
      setSelectedApiKey(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || '删除失败')
    },
  })

  // 更新 API Key
  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; label?: string; apiKey?: string; apiSecret?: string }) => {
      const { id, ...updateData } = data
      const response = await api.patch(`/api-keys/${id}`, updateData)
      return response.data
    },
    onSuccess: () => {
      toast.success('API Key 更新成功')
      // 刷新列表和余额
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      if (selectedApiKey) {
        queryClient.invalidateQueries({ queryKey: ['api-key-balance', selectedApiKey.id] })
      }
      setShowEditModal(false)
      setSelectedApiKey(null)
      setEditFormData({ apiKey: '', secretKey: '', passphrase: '', label: '' })
    },
    onError: (error: Error) => {
      toast.error(error.message || '更新失败')
    },
  })

  // 表单状态
  const [formData, setFormData] = useState({
    apiKey: '',
    secretKey: '',
    passphrase: '',
    label: '',
  })

  // 编辑表单状态
  const [editFormData, setEditFormData] = useState({
    apiKey: '',
    secretKey: '',
    passphrase: '',
    label: '',
  })

  // 打开编辑弹窗
  const handleOpenEdit = (apiKey: ApiKeyResponse) => {
    setSelectedApiKey(apiKey)
    // 标准 UX：API Key 和 Secret 留空（用户可选择性更新），Label 预填当前值
    setEditFormData({
      apiKey: '', // 留空，让用户输入新的（如需更新）
      secretKey: '', // 留空
      passphrase: '',
      label: apiKey.label,
    })
    setShowEditModal(true)
  }

  // 打开删除确认弹窗
  const handleOpenDelete = (apiKey: ApiKeyResponse) => {
    setSelectedApiKey(apiKey)
    setShowDeleteModal(true)
  }

  // 确认删除
  const handleConfirmDelete = () => {
    if (selectedApiKey) {
      deleteMutation.mutate(selectedApiKey.id)
    }
  }

  // 确认编辑
  const handleConfirmEdit = () => {
    if (!selectedApiKey) return

    // 构建更新数据
    const updateData: { id: string; label?: string; apiKey?: string; apiSecret?: string } = {
      id: selectedApiKey.id,
    }

    // 只有填写了的字段才更新
    if (editFormData.label && editFormData.label !== selectedApiKey.label) {
      updateData.label = editFormData.label
    }

    // 如果要更新 API Key，必须同时提供 Secret
    if (editFormData.apiKey && editFormData.secretKey) {
      updateData.apiKey = editFormData.apiKey
      updateData.apiSecret = editFormData.secretKey
    } else if (editFormData.apiKey && !editFormData.secretKey) {
      toast.error('更新 API Key 时必须同时提供 Secret Key')
      return
    } else if (!editFormData.apiKey && editFormData.secretKey) {
      toast.error('更新 Secret Key 时必须同时提供 API Key')
      return
    }

    // 如果没有任何更新，直接关闭
    if (Object.keys(updateData).length === 1) {
      toast.info('没有需要更新的内容')
      setShowEditModal(false)
      setSelectedApiKey(null)
      return
    }

    updateMutation.mutate(updateData)
  }

  // 提交添加
  const handleSubmitAdd = () => {
    if (!selectedExchange) return
    if (!formData.apiKey || !formData.secretKey) {
      toast.error('请填写 API Key 和 Secret Key')
      return
    }
    createMutation.mutate({
      exchange: selectedExchange,
      label: formData.label || getExchangeName(selectedExchange),
      apiKey: formData.apiKey,
      apiSecret: formData.secretKey,
    })
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // 加载状态
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    )
  }

  return (
    <div className="text-[#F8F8FC] font-sans">
          {/* 添加 API 按钮 - 青色样式 */}
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="w-full py-3.5 mb-6 rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] text-white font-medium transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:shadow-[0_0_30px_rgba(6,182,212,0.3)]"
          >
            <Plus className="w-5 h-5" />
            添加 API
          </button>

          {/* Bound API Keys */}
          <div className="mb-8">
            {boundApiKeys.length === 0 ? (
              <Card className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
                <CardContent className="p-8 text-center">
                  <Key className="w-12 h-12 text-[#606070] mx-auto mb-3" />
                  <p className="text-[#9090A0]">暂无绑定的 API Key</p>
                  <p className="text-[#606070] text-sm mt-1">点击上方按钮添加您的第一个交易所</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {boundApiKeys.map((key, index) => {
                  // 获取对应的余额数据
                  const balanceQuery = apiKeyBalanceQueries[index]
                  const balanceData = balanceQuery?.data
                  const totalValue = balanceData?.totalUsdValue || 0
                  const spotValue = balanceData?.spotValue || 0
                  const futuresValue = balanceData?.futuresValue || 0
                  const isLoadingBalance = balanceQuery?.isLoading
                  const permissions = balanceData?.permissions || []
                  const isVerifyFailed = balanceData && balanceData.valid === false
                  const verifyError = balanceData?.error

                  return (
                  <Card key={key.id} className={cn(
                    "glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden",
                    isVerifyFailed ? "border border-[#F43F5E]/30" : "border border-cyan-500/[0.08]"
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {/* Exchange Logo */}
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden",
                            isVerifyFailed ? "bg-[#F43F5E]/10" : "bg-[#1E1E2E]"
                          )}>
                            <Image src={getExchangeLogo(key.exchange)} alt={getExchangeName(key.exchange)} width={32} height={32} className={cn("object-contain", isVerifyFailed && "opacity-50")} />
                          </div>

                          {/* Info */}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{key.label}</span>
                              {isLoadingBalance ? (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#3B82F6]/20 text-[#3B82F6]">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  验证中
                                </span>
                              ) : isVerifyFailed ? (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#F43F5E]/20 text-[#F43F5E]">
                                  <AlertTriangle className="w-3 h-3" />
                                  验证失败
                                </span>
                              ) : key.isActive ? (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#10B981]/20 text-[#10B981]">
                                  <CheckCircle className="w-3 h-3" />
                                  已连接
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#F43F5E]/20 text-[#F43F5E]">
                                  <AlertCircle className="w-3 h-3" />
                                  已禁用
                                </span>
                              )}
                            </div>
                            {/* 余额显示 - 极简模式：只显示总额 */}
                            <div className="mt-1">
                              {isLoadingBalance ? (
                                <span className="text-[#9090A0] text-sm flex items-center gap-1">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  加载余额...
                                </span>
                              ) : isVerifyFailed ? (
                                <div className="text-[#F43F5E] text-sm">
                                  <span className="flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {verifyError || '无法连接到交易所，请检查 API 配置'}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-lg font-bold text-[#10B981]">
                                  ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions - 图标按钮（与移动端一致） */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => queryClient.invalidateQueries({ queryKey: ['api-key-balance', key.id] })}
                            title="刷新余额"
                            className="p-2 hover:bg-[#1E1E2E] rounded-lg transition-colors"
                          >
                            <RefreshCw className="w-4 h-4 text-[#9090A0] hover:text-[#F8F8FC]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(key)}
                            title="编辑"
                            className="p-2 hover:bg-[#1E1E2E] rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4 text-[#9090A0] hover:text-[#F8F8FC]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDelete(key)}
                            title="删除"
                            disabled={deleteMutation.isPending}
                            className="p-2 hover:bg-[#F43F5E]/10 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4 text-[#F43F5E]/70" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  )
                })}
              </div>
            )}
          </div>

      {/* Add API Key Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold mb-4">
                {selectedExchange
                  ? `绑定 ${supportedExchanges.find(e => e.id === selectedExchange)?.name} API`
                  : '选择交易所'
                }
              </h3>

              {!selectedExchange ? (
                // Exchange Selection
                <div className="grid grid-cols-3 gap-3">
                  {supportedExchanges.map((exchange) => (
                    <button
                      key={exchange.id}
                      type="button"
                      onClick={() => setSelectedExchange(exchange.id)}
                      className="p-4 rounded-xl bg-[#1E1E2E] hover:bg-[#2A2A3A] transition-colors text-center"
                    >
                      <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-[#12121A] flex items-center justify-center overflow-hidden">
                        <Image src={exchange.logo} alt={exchange.name} width={28} height={28} className="object-contain" />
                      </div>
                      <span className="text-sm">{exchange.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                // API Key Form
                <div className="space-y-4">
                  {/* Guide Link */}
                  <a
                    href={supportedExchanges.find(e => e.id === selectedExchange)?.guideUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-cyan-400 text-sm hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    如何获取 API Key？
                  </a>

                  {/* API Key Input */}
                  <div>
                    <label htmlFor="add-api-key" className="text-sm text-[#9090A0] block mb-1">API Key *</label>
                    <input
                      id="add-api-key"
                      type="text"
                      value={formData.apiKey}
                      onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                      placeholder="请输入 API Key"
                      className="w-full px-4 py-2.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  {/* Secret Key Input */}
                  <div>
                    <label htmlFor="add-secret-key" className="text-sm text-[#9090A0] block mb-1">Secret Key *</label>
                    <div className="relative">
                      <input
                        id="add-secret-key"
                        type={showSecret ? 'text' : 'password'}
                        value={formData.secretKey}
                        onChange={(e) => setFormData({ ...formData, secretKey: e.target.value })}
                        placeholder="请输入 Secret Key"
                        className="w-full px-4 py-2.5 pr-10 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        title={showSecret ? '隐藏密钥' : '显示密钥'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606070] hover:text-[#9090A0]"
                      >
                        {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Passphrase (for OKX) */}
                  {selectedExchange === 'okx' && (
                    <div>
                      <label htmlFor="add-passphrase" className="text-sm text-[#9090A0] block mb-1">Passphrase *</label>
                      <input
                        id="add-passphrase"
                        type="password"
                        value={formData.passphrase}
                        onChange={(e) => setFormData({ ...formData, passphrase: e.target.value })}
                        placeholder="请输入 Passphrase"
                        className="w-full px-4 py-2.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  )}

                  {/* Label Input */}
                  <div>
                    <label htmlFor="add-label" className="text-sm text-[#9090A0] block mb-1">备注名称（可选）</label>
                    <input
                      id="add-label"
                      type="text"
                      value={formData.label}
                      onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                      placeholder="如：主账户"
                      className="w-full px-4 py-2.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  {/* IP Whitelist Info */}
                  <Card className="bg-[#1E1E2E] border-[#2A2A3A]">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">IP 白名单</p>
                          <p className="text-[#606070] text-xs">请将以下 IP 添加到交易所白名单</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy('47.89.192.xxx')}
                          className="flex items-center gap-1 text-cyan-400 text-sm"
                        >
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          {copied ? '已复制' : '复制'}
                        </button>
                      </div>
                      <p className="font-mono text-sm mt-2 text-[#9090A0]">47.89.192.xxx</p>
                    </CardContent>
                  </Card>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1 border-[#2A2A3A] text-[#9090A0]"
                      onClick={() => {
                        setShowAddModal(false)
                        setSelectedExchange(null)
                        setFormData({ apiKey: '', secretKey: '', passphrase: '', label: '' })
                      }}
                      disabled={createMutation.isPending}
                    >
                      取消
                    </Button>
                    <Button
                      className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white"
                      onClick={handleSubmitAdd}
                      disabled={createMutation.isPending}
                    >
                      {createMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          绑定中...
                        </>
                      ) : (
                        '验证并绑定'
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit API Key Modal */}
      {showEditModal && selectedApiKey && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1E1E2E] flex items-center justify-center overflow-hidden">
                    <Image src={getExchangeLogo(selectedApiKey.exchange)} alt={getExchangeName(selectedApiKey.exchange)} width={28} height={28} className="object-contain" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">编辑 {selectedApiKey.label || getExchangeName(selectedApiKey.exchange)} API</h3>
                    <p className="text-[#9090A0] text-xs">更新 API 密钥配置</p>
                  </div>
                </div>
                <button
                  type="button"
                  title="关闭"
                  onClick={() => {
                    setShowEditModal(false)
                    setSelectedApiKey(null)
                  }}
                  className="p-2 hover:bg-[#1E1E2E] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-[#9090A0]" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Current API Key Info (readonly) */}
                <div className="p-3 rounded-lg bg-[#0A0A0F] border border-[#1E1E2E]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[#606070] mb-1">当前绑定的 API Key</p>
                      <p className="font-mono text-[#9090A0]">{selectedApiKey.maskedKey}</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-[#1E1E2E] text-[#10B981]">
                      <CheckCircle className="w-3 h-3 inline mr-1" />
                      已加密
                    </span>
                  </div>
                </div>

                {/* Divider with hint */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-[#2A2A3A]" />
                  <span className="text-xs text-[#606070]">以下字段留空则保持不变</span>
                  <div className="flex-1 h-px bg-[#2A2A3A]" />
                </div>

                {/* New API Key Input */}
                <div>
                  <label htmlFor="edit-api-key" className="text-sm text-[#9090A0] block mb-1">新 API Key</label>
                  <input
                    id="edit-api-key"
                    type="text"
                    value={editFormData.apiKey}
                    onChange={(e) => setEditFormData({ ...editFormData, apiKey: e.target.value })}
                    placeholder="留空保持当前密钥"
                    className="w-full px-4 py-2.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* New Secret Key Input */}
                <div>
                  <label htmlFor="edit-secret-key" className="text-sm text-[#9090A0] block mb-1">新 Secret Key</label>
                  <div className="relative">
                    <input
                      id="edit-secret-key"
                      type={showSecret ? 'text' : 'password'}
                      value={editFormData.secretKey}
                      onChange={(e) => setEditFormData({ ...editFormData, secretKey: e.target.value })}
                      placeholder="留空保持当前密钥"
                      className="w-full px-4 py-2.5 pr-10 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      title={showSecret ? '隐藏密钥' : '显示密钥'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606070] hover:text-[#9090A0]"
                    >
                      {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-[#606070] mt-1">更新密钥时需同时填写 API Key 和 Secret Key</p>
                </div>

                {/* Passphrase (for OKX) - 后端暂不支持 passphrase */}
                {selectedApiKey?.exchange === 'okx' && (
                  <div>
                    <label htmlFor="edit-passphrase" className="text-sm text-[#9090A0] block mb-1">Passphrase（留空则不更新）</label>
                    <input
                      id="edit-passphrase"
                      type="password"
                      value={editFormData.passphrase}
                      onChange={(e) => setEditFormData({ ...editFormData, passphrase: e.target.value })}
                      placeholder="输入新的 Passphrase"
                      className="w-full px-4 py-2.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                )}

                {/* Label Input */}
                <div>
                  <label htmlFor="edit-label" className="text-sm text-[#9090A0] block mb-1">备注名称</label>
                  <input
                    id="edit-label"
                    type="text"
                    value={editFormData.label}
                    onChange={(e) => setEditFormData({ ...editFormData, label: e.target.value })}
                    placeholder="如：主账户"
                    className="w-full px-4 py-2.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1 border-[#2A2A3A] text-[#9090A0]"
                    onClick={() => {
                      setShowEditModal(false)
                      setSelectedApiKey(null)
                    }}
                    disabled={updateMutation.isPending}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleConfirmEdit}
                    className="flex-1 bg-[#06B6D4] hover:bg-[#0891B2] text-white"
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      '保存更改'
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedApiKey && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <Card className="w-full max-w-md glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
            <CardContent className="p-6">
              <div className="text-center">
                {/* Warning Icon */}
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#F43F5E]/10 flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-[#F43F5E]" />
                </div>

                <h3 className="text-xl font-bold mb-2">确认删除</h3>
                <p className="text-[#9090A0] mb-6">
                  您确定要删除 <span className="text-[#F8F8FC] font-semibold">{selectedApiKey.label || getExchangeName(selectedApiKey.exchange)}</span> 的 API 密钥吗？
                </p>

                {/* API Key Info */}
                <div className="flex items-center gap-3 p-4 mb-6 rounded-xl bg-[#1E1E2E]/50 border border-[#2A2A3A]">
                  <div className="w-10 h-10 rounded-xl bg-[#2A2A3A] flex items-center justify-center overflow-hidden">
                    <Image src={getExchangeLogo(selectedApiKey.exchange)} alt={getExchangeName(selectedApiKey.exchange)} width={28} height={28} className="object-contain" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">{selectedApiKey.label || getExchangeName(selectedApiKey.exchange)}</p>
                    <p className="text-[#9090A0] text-sm font-mono">{selectedApiKey.maskedKey}</p>
                  </div>
                </div>

                {/* Warning Message */}
                <div className="p-3 mb-6 rounded-lg bg-[#F43F5E]/10 border border-[#F43F5E]/20 text-left">
                  <p className="text-sm text-[#F43F5E]">
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    删除后，使用此 API 的策略将无法继续执行交易。此操作不可撤销。
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 border-[#2A2A3A] text-[#9090A0]"
                    onClick={() => {
                      setShowDeleteModal(false)
                      setSelectedApiKey(null)
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleConfirmDelete}
                    className="flex-1 bg-[#F43F5E] hover:bg-[#E11D48] text-white"
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        确认删除
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
