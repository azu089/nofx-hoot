'use client';

import { useRouter } from 'next/navigation';
import { SettingsPage as SettingsPageUI } from '@/components/ui-v3/settings/settings-page';

export default function SettingsPage() {
  const router = useRouter();

  return (
    <SettingsPageUI
      onNavigate={(path) => router.push(path)}
      onSettingChange={(key, value) => {
        console.log('设置变更:', key, value);
        // TODO: 调用 API 保存设置
      }}
    />
  );
}
