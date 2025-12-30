import { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-dark px-4">
      <div className="w-full max-w-md">
        {/* Logo 和标题 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-danger/10 rounded-xl mb-4">
            <ShieldCheck className="w-8 h-8 text-danger" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">QuantFi 管理后台</h1>
          <p className="text-text-secondary">平台监控与管理系统</p>
        </div>

        {/* 认证表单 */}
        {children}

        {/* 底部提示 */}
        <p className="text-center text-text-tertiary text-sm mt-8">
          仅限授权管理员访问 | 所有操作将被记录
        </p>
      </div>
    </div>
  );
}
