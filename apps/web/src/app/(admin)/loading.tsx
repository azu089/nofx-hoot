/**
 * Admin 路由组的 Loading 兜底
 * 解决问题：页面转场（如 login → dashboard）期间显示黑屏
 * Next.js 在加载目标页面 JS 时，自动显示此组件
 */
export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-[#9090A0] text-sm">加载中...</p>
      </div>
    </div>
  );
}
