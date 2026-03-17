'use client'

import React from 'react'
import {
  ArrowLeft,
  BookOpen,
  Key,
  TrendingUp,
  CreditCard,
  Shield,
  Receipt,
  AlertCircle,
  CheckCircle2,
  Info,
  Lightbulb,
  ChevronRight
} from 'lucide-react'
import { useLocale } from '@/i18n/provider'
import { useTranslations } from 'next-intl'
import { helpArticles } from '@/lib/help-content'
import type { HelpSection } from '@/lib/help-content'

interface MobileHelpArticlePageProps {
  slug: string
  onBack?: () => void
  onNavigate?: (path: string) => void
}

// 文章图标映射
const articleIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  'getting-started': BookOpen,
  'api-keys': Key,
  'strategies': TrendingUp,
  'deposits-withdrawals': CreditCard,
  'security': Shield,
  'billing': Receipt
}

// 提示框图标映射
const alertIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  info: Info,
  warning: AlertCircle,
  success: CheckCircle2,
  tip: Lightbulb
}

// 提示框颜色映射
const alertColors: Record<string, { bg: string; border: string; icon: string }> = {
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    icon: 'text-blue-500'
  },
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    icon: 'text-amber-500'
  },
  success: {
    bg: 'bg-[#22C55E]/10',
    border: 'border-[#22C55E]/30',
    icon: 'text-[#22C55E]'
  },
  tip: {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    icon: 'text-cyan-500'
  }
}

export function MobileHelpArticlePage({ slug, onBack, onNavigate }: MobileHelpArticlePageProps) {
  const { locale: systemLocale } = useLocale()
  const t = useTranslations('help')
  const locale = systemLocale === 'en' ? 'en' : 'zh'

  const article = helpArticles[slug]

  // 如果文章不存在，显示错误状态
  if (!article) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] pb-20">
        {/* 顶部导航 */}
        <div className="sticky top-0 z-50 bg-[#0A0A0F] [transform:translateZ(0)] border-b border-[#1E1E2E]">
          <div className="flex items-center justify-between px-4 h-14">
            <button
              type="button"
              onClick={onBack}
              aria-label={t('back')}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#12121A] transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-base font-semibold text-white">{t('notFound')}</h1>
            <div className="w-10" />
          </div>
        </div>

        {/* 错误内容 */}
        <div className="flex flex-col items-center justify-center px-4 pt-20">
          <div className="w-16 h-16 bg-[#EF4444]/10 rounded-2xl flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-[#EF4444]" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">{t('articleNotFound')}</h2>
          <p className="text-sm text-[#94A3B8] text-center mb-6">{t('articleNotFoundDesc')}</p>
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {t('backToHelp')}
          </button>
        </div>
      </div>
    )
  }

  const title = locale === 'en' ? article.titleEn : article.titleZh
  const Icon = articleIcons[slug] || BookOpen

  // 渲染段落内容（支持列表和提示框）
  const renderContent = (content: string) => {
    const lines = content.split('\n')
    const elements: React.ReactElement[] = []
    let currentList: string[] = []
    let listType: 'bullet' | 'numbered' | null = null

    const flushList = () => {
      if (currentList.length > 0) {
        if (listType === 'bullet') {
          elements.push(
            <ul key={elements.length} className="space-y-2 mb-3">
              {currentList.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-cyan-500 mt-1">•</span>
                  <span className="flex-1 text-[#94A3B8]">{item}</span>
                </li>
              ))}
            </ul>
          )
        } else if (listType === 'numbered') {
          elements.push(
            <ol key={elements.length} className="space-y-2 mb-3">
              {currentList.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-cyan-500 font-medium mt-0.5">{i + 1}.</span>
                  <span className="flex-1 text-[#94A3B8]">{item}</span>
                </li>
              ))}
            </ol>
          )
        }
        currentList = []
        listType = null
      }
    }

    lines.forEach((line) => {
      const trimmed = line.trim()

      // 空行
      if (!trimmed) {
        flushList()
        return
      }

      // 标题
      if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        flushList()
        const heading = trimmed.slice(2, -2)
        elements.push(
          <h3 key={elements.length} className="text-sm font-semibold text-white mb-2 mt-4 first:mt-0">
            {heading}
          </h3>
        )
        return
      }

      // 无序列表（• 开头）
      if (trimmed.startsWith('•')) {
        if (listType !== 'bullet') {
          flushList()
          listType = 'bullet'
        }
        currentList.push(trimmed.slice(1).trim())
        return
      }

      // 有序列表（数字. 开头）
      const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)/)
      if (numberedMatch) {
        if (listType !== 'numbered') {
          flushList()
          listType = 'numbered'
        }
        currentList.push(numberedMatch[2])
        return
      }

      // 普通段落
      flushList()
      elements.push(
        <p key={elements.length} className="text-sm text-[#94A3B8] leading-relaxed mb-3">
          {trimmed}
        </p>
      )
    })

    flushList()
    return elements
  }

  // 渲染 section
  const renderSection = (section: HelpSection, index: number) => {
    const sectionTitle = locale === 'en' ? section.titleEn : section.titleZh
    const sectionContent = locale === 'en' ? section.contentEn : section.contentZh

    if (section.type) {
      // 提示框类型的 section
      const alertColor = alertColors[section.type]
      const AlertIcon = alertIcons[section.type]

      return (
        <div
          key={index}
          className={`glass-border-glow relative ${alertColor.bg} backdrop-blur-[72px] border ${alertColor.border} rounded-2xl p-4`}
        >
          <div className="flex items-start gap-3 mb-3">
            <div className={`w-8 h-8 ${alertColor.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
              <AlertIcon className={`w-4 h-4 ${alertColor.icon}`} />
            </div>
            <h3 className="text-sm font-semibold text-white flex-1">{sectionTitle}</h3>
          </div>
          <div className="pl-11">{renderContent(sectionContent)}</div>
        </div>
      )
    }

    // 普通 section
    return (
      <div
        key={index}
        className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4"
      >
        <div className="flex items-start gap-3 mb-3">
          <span className="text-cyan-500 font-semibold text-sm">{index + 1}.</span>
          <h3 className="text-sm font-semibold text-white flex-1">{sectionTitle}</h3>
        </div>
        <div className="pl-6">{renderContent(sectionContent)}</div>
      </div>
    )
  }

  // 获取其他文章（相关推荐）
  const relatedArticles = Object.entries(helpArticles)
    .filter(([key]) => key !== slug)
    .slice(0, 3)

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20">
      {/* 顶部粘性导航 */}
      <div className="sticky top-0 z-50 bg-[#0A0A0F] [transform:translateZ(0)] border-b border-[#1E1E2E]">
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            type="button"
            onClick={onBack}
            aria-label={t('back')}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#12121A] transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-8 h-8 bg-cyan-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-cyan-500" />
            </div>
            <h1 className="text-base font-semibold text-white truncate">{title}</h1>
          </div>
        </div>
      </div>

      {/* 文章内容 */}
      <div className="px-4 pt-4 space-y-4">
        {/* Sections */}
        {article.sections.map((section, index) => renderSection(section, index))}

        {/* 相关文章推荐 */}
        {relatedArticles.length > 0 && (
          <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1E1E2E]/50">
              <span className="text-sm font-medium text-white">{t('relatedArticles')}</span>
            </div>
            <div className="divide-y divide-[#1E1E2E]/50">
              {relatedArticles.map(([relatedSlug, relatedArticle]) => {
                const RelatedIcon = articleIcons[relatedSlug] || BookOpen
                const relatedTitle = locale === 'en' ? relatedArticle.titleEn : relatedArticle.titleZh
                const relatedDesc = locale === 'en' ? relatedArticle.descriptionEn : relatedArticle.descriptionZh

                return (
                  <button
                    key={relatedSlug}
                    type="button"
                    onClick={() => onNavigate?.(`/help/${relatedSlug}`)}
                    className="w-full flex items-start gap-3 p-4 hover:bg-white/5 transition-colors text-left"
                  >
                    <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                      <RelatedIcon className="w-5 h-5 text-cyan-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-white mb-1">{relatedTitle}</h4>
                      <p className="text-xs text-[#94A3B8] line-clamp-2">{relatedDesc}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[#94A3B8] flex-shrink-0 mt-2" />
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* 底部留白（移动端导航空间） */}
      <div className="h-20" />
    </div>
  )
}
