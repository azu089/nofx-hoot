/**
 * Admin 子页面 Loading
 * 当已登录进入管理后台后，切换子页面时显示骨架屏
 */
export default function AdminPageLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* 页面标题骨架 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#1E1E2E] animate-pulse" />
          <div>
            <div className="h-6 w-40 bg-[#1E1E2E] rounded animate-pulse" />
            <div className="h-4 w-56 bg-[#1E1E2E] rounded animate-pulse mt-2" />
          </div>
        </div>
        <div className="h-9 w-20 bg-[#1E1E2E] rounded-lg animate-pulse" />
      </div>

      {/* 统计卡片骨架 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl p-5 border border-[#1E1E2E] bg-[#12121A]"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="h-4 w-20 bg-[#1E1E2E] rounded animate-pulse" />
              <div className="w-10 h-10 rounded-xl bg-[#1E1E2E] animate-pulse" />
            </div>
            <div className="h-8 w-24 bg-[#1E1E2E] rounded animate-pulse mb-2" />
            <div className="h-3 w-16 bg-[#1E1E2E] rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
