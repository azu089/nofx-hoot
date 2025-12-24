export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-primary-600 mb-4">
          QuantFi
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Web3 量化 SaaS 平台
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/login"
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            登录
          </a>
          <a
            href="/register"
            className="px-6 py-3 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 transition"
          >
            注册
          </a>
        </div>
        <p className="mt-8 text-sm text-gray-400">
          v0.1.0 - 开发中
        </p>
      </div>
    </main>
  );
}
