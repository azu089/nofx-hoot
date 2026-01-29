'use client'

import { TrendingUp, Wallet, Zap, Activity } from 'lucide-react'

export function GlassEffectDemo() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] p-6">
      {/* Background with subtle grid pattern for glass effect visibility */}
      <div className="fixed inset-0 bg-[#0A0A0F]">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">玻璃效果对比演示</h1>
        <p className="text-[#9090A0] mb-8">对比当前样式与两种提升方案的视觉效果</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Current Style */}
          <div>
            <h2 className="text-lg font-semibold mb-4 text-[#9090A0]">当前样式</h2>
            <div className="bg-[#12121A]/80 backdrop-blur-xl border border-[#1E1E2E] rounded-2xl p-6 shadow-[0_0_30px_rgba(6,182,212,0.05)]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-cyan-500/10 rounded-lg flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <div className="font-semibold">总资产</div>
                  <div className="text-sm text-[#9090A0]">Portfolio Value</div>
                </div>
              </div>
              <div className="text-3xl font-bold mb-4">$125,847.32</div>
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <TrendingUp className="w-4 h-4" />
                <span>+2.34% (24h)</span>
              </div>
              <div className="mt-4 pt-4 border-t border-[#1E1E2E]">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-[#0A0A0F]/50 rounded-lg border border-[#1E1E2E]">
                    <div className="text-xs text-[#606070]">今日盈亏</div>
                    <div className="font-semibold text-green-400">+$2,847</div>
                  </div>
                  <div className="p-3 bg-[#0A0A0F]/50 rounded-lg border border-[#1E1E2E]">
                    <div className="text-xs text-[#606070]">持仓数</div>
                    <div className="font-semibold">12</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 text-xs text-[#606070] space-y-1">
              <div>• 透明度: 80%</div>
              <div>• 边框: #1E1E2E</div>
              <div>• 光晕: 5% 透明度</div>
            </div>
          </div>

          {/* Plan A - Subtle Enhancement */}
          <div>
            <h2 className="text-lg font-semibold mb-4 text-cyan-400">方案 A：轻微提升</h2>
            <div className="relative overflow-hidden bg-[#12121A]/60 backdrop-blur-xl border border-[#2A2A3A]/80 rounded-2xl p-6 shadow-[0_0_40px_rgba(6,182,212,0.12)]">
              {/* Top highlight line */}
              <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-500/20 to-cyan-400/10 rounded-lg flex items-center justify-center border border-cyan-500/20">
                  <Wallet className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <div className="font-semibold">总资产</div>
                  <div className="text-sm text-[#9090A0]">Portfolio Value</div>
                </div>
              </div>
              <div className="text-3xl font-bold mb-4">$125,847.32</div>
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <TrendingUp className="w-4 h-4" />
                <span>+2.34% (24h)</span>
              </div>
              <div className="mt-4 pt-4 border-t border-[#2A2A3A]/60">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-[#0A0A0F]/40 rounded-lg border border-[#2A2A3A]/50">
                    <div className="text-xs text-[#707080]">今日盈亏</div>
                    <div className="font-semibold text-green-400">+$2,847</div>
                  </div>
                  <div className="p-3 bg-[#0A0A0F]/40 rounded-lg border border-[#2A2A3A]/50">
                    <div className="text-xs text-[#707080]">持仓数</div>
                    <div className="font-semibold">12</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 text-xs text-cyan-400/80 space-y-1">
              <div>• 透明度: 60% (更透)</div>
              <div>• 边框: #2A2A3A (更亮)</div>
              <div>• 光晕: 12% 透明度</div>
              <div>• 顶部高光线</div>
            </div>
          </div>

          {/* Plan B - Strong Tech Feel */}
          <div>
            <h2 className="text-lg font-semibold mb-4 text-purple-400">方案 B：强化科技感</h2>
            <div className="relative overflow-hidden bg-gradient-to-br from-[#12121A]/50 to-[#0A0A0F]/70 backdrop-blur-xl rounded-2xl p-6 shadow-[0_0_50px_rgba(6,182,212,0.15),0_0_100px_rgba(139,92,246,0.08)] group">
              {/* Animated gradient border */}
              <div className="absolute inset-0 rounded-2xl p-px bg-gradient-to-br from-cyan-500/30 via-transparent to-purple-500/30">
                <div className="absolute inset-px rounded-2xl bg-[#0A0A0F]/90" />
              </div>

              {/* Top highlight line with glow */}
              <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />

              {/* Scan line animation */}
              <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent h-20 animate-scan" />
              </div>

              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-cyan-500/30 to-purple-500/20 rounded-lg flex items-center justify-center border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                    <Wallet className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <div className="font-semibold">总资产</div>
                    <div className="text-sm text-[#9090A0]">Portfolio Value</div>
                  </div>
                </div>
                <div className="text-3xl font-bold mb-4 bg-gradient-to-r from-white to-cyan-100 bg-clip-text text-transparent">$125,847.32</div>
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <TrendingUp className="w-4 h-4" />
                  <span>+2.34% (24h)</span>
                </div>
                <div className="mt-4 pt-4 border-t border-cyan-500/20">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-cyan-500/5 rounded-lg border border-cyan-500/20 hover:border-cyan-500/40 transition-colors">
                      <div className="text-xs text-[#707080]">今日盈亏</div>
                      <div className="font-semibold text-green-400">+$2,847</div>
                    </div>
                    <div className="p-3 bg-purple-500/5 rounded-lg border border-purple-500/20 hover:border-purple-500/40 transition-colors">
                      <div className="text-xs text-[#707080]">持仓数</div>
                      <div className="font-semibold">12</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Corner accents */}
              <div className="absolute top-2 left-2 w-3 h-3 border-l-2 border-t-2 border-cyan-500/40 rounded-tl" />
              <div className="absolute top-2 right-2 w-3 h-3 border-r-2 border-t-2 border-cyan-500/40 rounded-tr" />
              <div className="absolute bottom-2 left-2 w-3 h-3 border-l-2 border-b-2 border-purple-500/40 rounded-bl" />
              <div className="absolute bottom-2 right-2 w-3 h-3 border-r-2 border-b-2 border-purple-500/40 rounded-br" />
            </div>
            <div className="mt-3 text-xs text-purple-400/80 space-y-1">
              <div>• 渐变边框 (青→紫)</div>
              <div>• 双色光晕效果</div>
              <div>• 扫描线动画</div>
              <div>• 角落装饰</div>
              <div>• 渐变文字</div>
            </div>
          </div>
        </div>

        {/* Additional Card Examples */}
        <h2 className="text-xl font-semibold mt-12 mb-6">更多卡片对比</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Current - Small Card */}
          <div>
            <h3 className="text-sm text-[#9090A0] mb-3">当前 - 小卡片</h3>
            <div className="p-4 bg-[#12121A]/80 backdrop-blur-xl border border-[#1E1E2E] rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center">
                  <Activity className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <div className="text-sm font-medium">运行中策略</div>
                  <div className="text-xl font-bold text-green-400">8</div>
                </div>
              </div>
            </div>
          </div>

          {/* Plan A - Small Card */}
          <div>
            <h3 className="text-sm text-cyan-400 mb-3">方案 A - 小卡片</h3>
            <div className="relative p-4 bg-[#12121A]/60 backdrop-blur-xl border border-[#2A2A3A]/80 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.08)]">
              <div className="absolute top-0 left-3 right-3 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-green-500/20 to-green-400/10 rounded-lg flex items-center justify-center border border-green-500/20">
                  <Activity className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <div className="text-sm font-medium">运行中策略</div>
                  <div className="text-xl font-bold text-green-400">8</div>
                </div>
              </div>
            </div>
          </div>

          {/* Plan B - Small Card */}
          <div>
            <h3 className="text-sm text-purple-400 mb-3">方案 B - 小卡片</h3>
            <div className="relative p-4 bg-gradient-to-br from-[#12121A]/50 to-[#0A0A0F]/70 backdrop-blur-xl rounded-xl shadow-[0_0_25px_rgba(16,185,129,0.12)]">
              <div className="absolute inset-0 rounded-xl p-px bg-gradient-to-br from-green-500/30 via-transparent to-cyan-500/20">
                <div className="absolute inset-px rounded-xl bg-[#0A0A0F]/90" />
              </div>
              <div className="absolute top-0 left-3 right-3 h-px bg-gradient-to-r from-transparent via-green-400/50 to-transparent" />
              <div className="relative z-10 flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-green-500/30 to-green-400/10 rounded-lg flex items-center justify-center border border-green-500/30 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                  <Activity className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <div className="text-sm font-medium">运行中策略</div>
                  <div className="text-xl font-bold text-green-400">8</div>
                </div>
              </div>
              <div className="absolute top-1 left-1 w-2 h-2 border-l border-t border-green-500/40 rounded-tl" />
              <div className="absolute bottom-1 right-1 w-2 h-2 border-r border-b border-green-500/40 rounded-br" />
            </div>
          </div>
        </div>

        {/* Button Examples */}
        <h2 className="text-xl font-semibold mt-12 mb-6">按钮对比</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div>
            <h3 className="text-sm text-[#9090A0] mb-3">当前</h3>
            <div className="flex gap-3">
              <button className="px-4 py-2 bg-[#06B6D4] text-white rounded-lg font-medium">
                主按钮
              </button>
              <button className="px-4 py-2 bg-[#12121A]/80 border border-[#1E1E2E] rounded-lg">
                次按钮
              </button>
            </div>
          </div>
          <div>
            <h3 className="text-sm text-cyan-400 mb-3">方案 A</h3>
            <div className="flex gap-3">
              <button className="px-4 py-2 bg-[#06B6D4] text-white rounded-lg font-medium shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-shadow">
                主按钮
              </button>
              <button className="px-4 py-2 bg-[#12121A]/60 border border-[#2A2A3A] rounded-lg hover:border-cyan-500/50 transition-colors">
                次按钮
              </button>
            </div>
          </div>
          <div>
            <h3 className="text-sm text-purple-400 mb-3">方案 B</h3>
            <div className="flex gap-3">
              <button className="relative px-4 py-2 bg-gradient-to-r from-cyan-500 to-cyan-400 text-black rounded-lg font-medium shadow-[0_0_25px_rgba(6,182,212,0.4)] hover:shadow-[0_0_35px_rgba(6,182,212,0.5)] transition-shadow overflow-hidden">
                <span className="relative z-10">主按钮</span>
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent" />
              </button>
              <button className="relative px-4 py-2 bg-[#12121A]/50 rounded-lg overflow-hidden group">
                <div className="absolute inset-0 rounded-lg p-px bg-gradient-to-r from-cyan-500/50 to-purple-500/50 opacity-50 group-hover:opacity-100 transition-opacity">
                  <div className="absolute inset-px rounded-lg bg-[#0A0A0F]" />
                </div>
                <span className="relative z-10">次按钮</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CSS for scan animation */}
      <style jsx>{`
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(500%); }
        }
        .animate-scan {
          animation: scan 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
