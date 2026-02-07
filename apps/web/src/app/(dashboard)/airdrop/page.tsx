'use client';

import { useRouter } from 'next/navigation';
import { MobileAirdropPage } from '@/components/ui-v3/mobile/mobile-airdrop-page';
import { AirdropPageV3 } from '@/components/ui-v3/airdrop/airdrop-page-v3';
import { useCheckinStatus, useCheckin, useAirdropHistory, useTaskList } from '@/hooks/use-airdrop';

export default function AirdropPage() {
  const router = useRouter();

  const { data: checkinStatus } = useCheckinStatus();
  const { data: history } = useAirdropHistory();
  const { data: tasks } = useTaskList();
  const checkinMutation = useCheckin();

  const handleCheckin = () => {
    checkinMutation.mutate();
  };

  const pageProps = {
    checkinStatus: checkinStatus || undefined,
    history: history || undefined,
    tasks: tasks || undefined,
    onCheckin: handleCheckin,
    isCheckinLoading: checkinMutation.isPending,
  };

  return (
    <>
      {/* 桌面端 */}
      <div className="hidden md:block">
        <AirdropPageV3 {...pageProps} />
      </div>

      {/* 移动端 */}
      <div className="block md:hidden">
        <MobileAirdropPage
          onBack={() => router.push('/dashboard')}
          {...pageProps}
        />
      </div>
    </>
  );
}
