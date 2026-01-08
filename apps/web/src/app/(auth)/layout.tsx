import Link from 'next/link';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg-primary flex flex-col relative overflow-hidden">
      {/* 固定网格背景 */}
      <div className="bg-grid-full" />

      {/* 顶部光晕 */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px]
          bg-brand-primary/15 rounded-full blur-[100px] opacity-30 pointer-events-none"
      />

      {/* 左下角光晕 */}
      <div
        className="absolute bottom-0 left-0 w-[600px] h-[400px]
          bg-success/10 rounded-full blur-[80px] opacity-20 pointer-events-none"
      />

      {/* 右下角光晕 */}
      <div
        className="absolute bottom-0 right-0 w-[500px] h-[350px]
          bg-brand-secondary/10 rounded-full blur-[80px] opacity-20 pointer-events-none"
      />

      {/* Header */}
      <header className="p-6 relative z-10">
        <Link href="/" className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-lg flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-sm">Q</span>
          </div>
          <span className="text-xl font-bold text-text-primary">QuantFi</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
        {children}
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-text-tertiary text-sm relative z-10">
        <p>&copy; 2024 QuantFi. All rights reserved.</p>
      </footer>
    </div>
  );
}
