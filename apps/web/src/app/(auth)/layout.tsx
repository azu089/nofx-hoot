import { LanguageSelector } from '@/components/ui-v3/shared/language-selector';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      {/* 语言选择器 — 固定在右上角 */}
      <div className="fixed top-4 right-4 z-50">
        <LanguageSelector />
      </div>
      {children}
    </div>
  );
}
