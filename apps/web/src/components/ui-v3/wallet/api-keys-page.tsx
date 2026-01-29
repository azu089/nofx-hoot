'use client'

import { useState } from 'react'
import { Key, Plus, Trash2, Eye, EyeOff, CheckCircle, AlertCircle, ExternalLink, Copy, Check, X, AlertTriangle, Edit } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
// Sidebar is handled by parent layout
import { cn } from '@/lib/utils'

// 支持的交易所
const supportedExchanges = [
  { id: 'binance', name: 'Binance', logo: '/icons/exchanges/币安.png', guideUrl: 'https://www.binance.com/api-management' },
  { id: 'okx', name: 'OKX', logo: '/icons/exchanges/okx.png', guideUrl: 'https://www.okx.com/account/my-api' },
  { id: 'bybit', name: 'Bybit', logo: '/icons/exchanges/bybit.png', guideUrl: 'https://www.bybit.com/app/user/api-management' },
  { id: 'gate', name: 'Gate.io', logo: '/icons/exchanges/gate.png', guideUrl: 'https://www.gate.io/myaccount/apikeys' },
  { id: 'bitget', name: 'Bitget', logo: '/icons/exchanges/bitget.png', guideUrl: 'https://www.bitget.com/api' },
  { id: 'coinbase', name: 'Coinbase', logo: '/icons/exchanges/coinbase.png', guideUrl: 'https://www.coinbase.com/settings/api' },
]

// 已绑定的 API Keys
const boundApiKeys = [
  {
    id: 1,
    exchange: 'binance',
    name: 'Binance',
    logo: '/icons/exchanges/币安.png',
    apiKey: 'vK8x...j2Qp',
    status: 'connected',
    permissions: ['现货交易', '合约交易'],
    balance: '$5,234.56',
    createdAt: '2026-01-10',
  },
  {
    id: 2,
    exchange: 'okx',
    name: 'OKX',
    logo: '/icons/exchanges/okx.png',
    apiKey: 'aB3c...9dEf',
    status: 'error',
    permissions: ['现货交易'],
    balance: '--',
    error: 'API Key 已过期',
    createdAt: '2025-12-20',
  },
]

export function ApiKeysPage() {
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedExchange, setSelectedExchange] = useState<string | null>(null)
  const [selectedApiKey, setSelectedApiKey] = useState<typeof boundApiKeys[0] | null>(null)
  const [showSecret, setShowSecret] = useState(false)
  const [copied, setCopied] = useState(false)

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
  const handleOpenEdit = (apiKey: typeof boundApiKeys[0]) => {
    setSelectedApiKey(apiKey)
    setEditFormData({
      apiKey: apiKey.apiKey,
      secretKey: '',
      passphrase: '',
      label: apiKey.name,
    })
    setShowEditModal(true)
  }

  // 打开删除确认弹窗
  const handleOpenDelete = (apiKey: typeof boundApiKeys[0]) => {
    setSelectedApiKey(apiKey)
    setShowDeleteModal(true)
  }

  // 确认删除
  const handleConfirmDelete = () => {
    // TODO: 调用删除 API
    console.log('删除 API Key:', selectedApiKey?.id)
    setShowDeleteModal(false)
    setSelectedApiKey(null)
  }

  // 确认编辑
  const handleConfirmEdit = () => {
    // TODO: 调用更新 API
    console.log('更新 API Key:', selectedApiKey?.id, editFormData)
    setShowEditModal(false)
    setSelectedApiKey(null)
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] font-sans p-6">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">API 密钥管理</h1>
            </div>
            <Button
              onClick={() => setShowAddModal(true)}
              className="bg-[#1E1E2E] hover:bg-[#2A2A3A] text-[#F8F8FC] border border-[#2A2A3A]"
            >
              <Plus className="w-4 h-4 mr-2" />
              添加 API Key
            </Button>
          </div>

          {/* Bound API Keys */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">已绑定的交易所</h2>

            {boundApiKeys.length === 0 ? (
              <Card className="bg-[#12121A] border-[#1E1E2E]">
                <CardContent className="p-8 text-center">
                  <Key className="w-12 h-12 text-[#606070] mx-auto mb-3" />
                  <p className="text-[#9090A0]">暂无绑定的 API Key</p>
                  <p className="text-[#606070] text-sm mt-1">点击上方按钮添加您的第一个交易所</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {boundApiKeys.map((key) => (
                  <Card key={key.id} className="bg-[#12121A] border-[#1E1E2E]">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {/* Exchange Logo */}
                          <div className="w-12 h-12 rounded-xl bg-[#1E1E2E] flex items-center justify-center overflow-hidden">
                            <img src={key.logo} alt={key.name} className="w-8 h-8 object-contain" />
                          </div>

                          {/* Info */}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{key.name}</span>
                              {key.status === 'connected' ? (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#10B981]/20 text-[#10B981]">
                                  <CheckCircle className="w-3 h-3" />
                                  已连接
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#F43F5E]/20 text-[#F43F5E]">
                                  <AlertCircle className="w-3 h-3" />
                                  连接失败
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-sm">
                              <span className="text-[#9090A0]">
                                API: <span className="font-mono">{key.apiKey}</span>
                              </span>
                              <span className="text-[#606070]">|</span>
                              <span className="text-[#9090A0]">
                                权限: {key.permissions.join(', ')}
                              </span>
                            </div>
                            {key.error && (
                              <p className="text-[#F43F5E] text-xs mt-1">{key.error}</p>
                            )}
                          </div>
                        </div>

                        {/* Balance & Actions */}
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-[#9090A0] text-xs">交易所余额</p>
                            <p className={cn(
                              "font-mono font-bold",
                              key.status === 'connected' ? "text-[#F8F8FC]" : "text-[#606070]"
                            )}>
                              {key.balance}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenEdit(key)}
                              className="border-[#2A2A3A] text-[#9090A0] hover:text-[#F8F8FC]"
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              编辑
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenDelete(key)}
                              className="border-[#F43F5E]/50 text-[#F43F5E] hover:bg-[#F43F5E]/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

      {/* Add API Key Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg bg-[#12121A] border-[#1E1E2E]">
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
                        <img src={exchange.logo} alt={exchange.name} className="w-7 h-7 object-contain" />
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
                    >
                      取消
                    </Button>
                    <Button
                      className="flex-1 bg-[#1E1E2E] hover:bg-[#2A2A3A] text-[#F8F8FC] border border-[#2A2A3A]"
                    >
                      验证并绑定
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
          <Card className="w-full max-w-lg bg-[#12121A] border-[#1E1E2E]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1E1E2E] flex items-center justify-center overflow-hidden">
                    <img src={selectedApiKey.logo} alt={selectedApiKey.name} className="w-7 h-7 object-contain" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">编辑 {selectedApiKey.name} API</h3>
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
                {/* Current API Key (readonly) */}
                <div>
                  <label className="text-sm text-[#9090A0] block mb-1">当前 API Key</label>
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0A0A0F] border border-[#1E1E2E]">
                    <span className="font-mono text-[#606070]">{selectedApiKey.apiKey}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-[#1E1E2E] text-[#9090A0]">已加密存储</span>
                  </div>
                </div>

                {/* New API Key Input */}
                <div>
                  <label htmlFor="edit-api-key" className="text-sm text-[#9090A0] block mb-1">新 API Key（留空则不更新）</label>
                  <input
                    id="edit-api-key"
                    type="text"
                    value={editFormData.apiKey}
                    onChange={(e) => setEditFormData({ ...editFormData, apiKey: e.target.value })}
                    placeholder="输入新的 API Key"
                    className="w-full px-4 py-2.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* New Secret Key Input */}
                <div>
                  <label htmlFor="edit-secret-key" className="text-sm text-[#9090A0] block mb-1">新 Secret Key（留空则不更新）</label>
                  <div className="relative">
                    <input
                      id="edit-secret-key"
                      type={showSecret ? 'text' : 'password'}
                      value={editFormData.secretKey}
                      onChange={(e) => setEditFormData({ ...editFormData, secretKey: e.target.value })}
                      placeholder="输入新的 Secret Key"
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
                {selectedApiKey.exchange === 'okx' && (
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
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleConfirmEdit}
                    className="flex-1 bg-[#06B6D4] hover:bg-[#0891B2] text-white"
                  >
                    保存更改
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
          <Card className="w-full max-w-md bg-[#12121A] border-[#1E1E2E]">
            <CardContent className="p-6">
              <div className="text-center">
                {/* Warning Icon */}
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#F43F5E]/10 flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-[#F43F5E]" />
                </div>

                <h3 className="text-xl font-bold mb-2">确认删除</h3>
                <p className="text-[#9090A0] mb-6">
                  您确定要删除 <span className="text-[#F8F8FC] font-semibold">{selectedApiKey.name}</span> 的 API 密钥吗？
                </p>

                {/* API Key Info */}
                <div className="flex items-center gap-3 p-4 mb-6 rounded-xl bg-[#1E1E2E]/50 border border-[#2A2A3A]">
                  <div className="w-10 h-10 rounded-xl bg-[#2A2A3A] flex items-center justify-center overflow-hidden">
                    <img src={selectedApiKey.logo} alt={selectedApiKey.name} className="w-7 h-7 object-contain" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">{selectedApiKey.name}</p>
                    <p className="text-[#9090A0] text-sm font-mono">{selectedApiKey.apiKey}</p>
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
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleConfirmDelete}
                    className="flex-1 bg-[#F43F5E] hover:bg-[#E11D48] text-white"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    确认删除
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
