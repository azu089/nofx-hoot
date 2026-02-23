import Link from 'next/link'
import { FileQuestion, Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-16"
      style={{ backgroundColor: '#0A0A0F' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 flex flex-col items-center text-center"
        style={{
          backgroundColor: '#12121A',
          border: '1px solid #2A2A3A',
        }}
      >
        {/* 图标 */}
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
          style={{ backgroundColor: 'rgba(6, 182, 212, 0.10)' }}
        >
          <FileQuestion
            size={32}
            style={{ color: '#06B6D4' }}
            aria-hidden="true"
          />
        </div>

        {/* 大号 404 */}
        <p
          className="text-7xl font-extrabold tracking-tight mb-4 leading-none"
          style={{ color: '#06B6D4' }}
        >
          404
        </p>

        {/* 标题 */}
        <h1
          className="text-2xl font-bold mb-3"
          style={{ color: '#F8F8FC' }}
        >
          页面未找到
        </h1>

        {/* 副标题 */}
        <p
          className="text-sm leading-relaxed mb-8"
          style={{ color: '#9090A0' }}
        >
          您访问的页面不存在或已被移除。
          <br />
          请检查链接是否正确，或返回首页。
        </p>

        {/* 返回首页按钮 */}
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-200 hover:opacity-90 active:scale-95"
          style={{
            backgroundColor: '#06B6D4',
            color: '#0A0A0F',
          }}
        >
          <Home size={16} aria-hidden="true" />
          返回首页
        </Link>
      </div>
    </div>
  )
}
