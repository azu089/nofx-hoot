import { Globe, Lock, Eye, EyeOff } from 'lucide-react'

interface PublishSettingsEditorProps {
  isPublic: boolean
  configVisible: boolean
  onIsPublicChange: (value: boolean) => void
  onConfigVisibleChange: (value: boolean) => void
  disabled?: boolean
  language: string
}

export function PublishSettingsEditor({
  isPublic,
  configVisible,
  onIsPublicChange,
  onConfigVisibleChange,
  disabled = false,
  language,
}: PublishSettingsEditorProps) {
  const t = (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      publishToMarket: { zh: '发布到策略市场', en: 'Publish to Market' },
      publishDesc: { zh: '策略将在市场公开展示，其他用户可发现并使用', en: 'Strategy will be publicly visible in the marketplace' },
      showConfig: { zh: '公开配置参数', en: 'Show Config' },
      showConfigDesc: { zh: '允许他人查看和复制详细配置', en: 'Allow others to view and clone config details' },
      private: { zh: '私有', en: 'PRIVATE' },
      public: { zh: '公开', en: 'PUBLIC' },
      hidden: { zh: '隐藏', en: 'HIDDEN' },
      visible: { zh: '可见', en: 'VISIBLE' },
    }
    return translations[key]?.[language] || key
  }

  // 开关组件
  const Toggle = ({ on }: { on: boolean }) => (
    <div
      className="relative w-10 h-5 rounded-full transition-all duration-300 flex-shrink-0"
      style={{
        background: on ? 'rgba(16, 185, 129, 0.6)' : 'rgba(255, 255, 255, 0.1)',
        boxShadow: on ? '0 0 12px rgba(16, 185, 129, 0.35)' : 'none',
      }}
    >
      <div
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-300"
        style={{
          left: on ? '22px' : '2px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
        }}
      />
    </div>
  )

  const Row = ({
    icon,
    title,
    desc,
    status,
    active,
    onClick,
  }: {
    icon: React.ReactNode
    title: string
    desc: string
    status: string
    active: boolean
    onClick: () => void
  }) => (
    <div
      className={`flex items-center justify-between gap-3 py-3 fade-divider-b transition-all ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      }`}
      onClick={() => !disabled && onClick()}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex-shrink-0 text-emerald-400">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-nofx-text">{title}</div>
          <div className="text-xs mt-0.5 text-nofx-text-muted">{desc}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          className={`text-[10px] font-mono font-medium tracking-wider ${
            active ? 'text-emerald-400' : 'text-nofx-text-muted'
          }`}
        >
          {status}
        </span>
        <Toggle on={active} />
      </div>
    </div>
  )

  return (
    <div>
      <Row
        icon={isPublic ? <Globe className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
        title={t('publishToMarket')}
        desc={t('publishDesc')}
        status={isPublic ? t('public') : t('private')}
        active={isPublic}
        onClick={() => onIsPublicChange(!isPublic)}
      />

      {isPublic && (
        <Row
          icon={configVisible ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
          title={t('showConfig')}
          desc={t('showConfigDesc')}
          status={configVisible ? t('visible') : t('hidden')}
          active={configVisible}
          onClick={() => onConfigVisibleChange(!configVisible)}
        />
      )}
    </div>
  )
}

export default PublishSettingsEditor
