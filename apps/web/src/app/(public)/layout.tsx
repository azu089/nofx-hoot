/**
 * 公开页面布局
 * 用于无需登录的独立页面（帮助中心等）
 * 这些页面有自己的完整布局，不需要额外包装
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
