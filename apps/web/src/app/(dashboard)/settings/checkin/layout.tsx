import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '每日签到 - QuantFi',
  description: '每日签到领取积分，连续签到获得更多奖励',
};

export default function CheckinLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
