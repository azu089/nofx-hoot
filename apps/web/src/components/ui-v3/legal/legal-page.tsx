'use client'

import { useState } from 'react'
import {
  ArrowLeft,
  FileText,
  Shield,
  AlertTriangle,
  Calendar,
} from 'lucide-react'
import { legalDocuments, type LegalDocumentContent } from '@/lib/legal-content'

interface LegalPageProps {
  slug: 'terms' | 'privacy' | 'risk'
  onBack?: () => void
}

// 文档图标映射
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  terms: FileText,
  privacy: Shield,
  risk: AlertTriangle
}

export function LegalPage({ slug, onBack }: LegalPageProps) {
  const [locale, setLocale] = useState<'zh' | 'en'>('zh')
  const document: LegalDocumentContent | undefined = legalDocuments[slug]

  if (!document) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-[#606070] mx-auto mb-4" />
          <p className="text-[#9090A0]">文档不存在</p>
          <button
            onClick={onBack}
            className="mt-4 px-4 py-2 bg-[#06B6D4] text-white rounded-lg"
          >
            返回
          </button>
        </div>
      </div>
    )
  }

  const IconComponent = iconMap[slug] || FileText
  const title = locale === 'zh' ? document.titleZh : document.titleEn
  const content = locale === 'zh' ? document.contentZh : document.contentEn

  // 解析内联 Markdown（加粗、斜体等）
  const parseInlineMarkdown = (text: string): React.ReactNode => {
    // 处理 **加粗** 文本
    const parts: React.ReactNode[] = []
    const regex = /\*\*(.*?)\*\*/g
    let lastIndex = 0
    let match

    while ((match = regex.exec(text)) !== null) {
      // 添加匹配前的普通文本
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index))
      }
      // 添加加粗文本
      parts.push(
        <strong key={match.index} className="text-[#F8F8FC] font-semibold">
          {match[1]}
        </strong>
      )
      lastIndex = regex.lastIndex
    }

    // 添加剩余的普通文本
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex))
    }

    return parts.length > 0 ? parts : text
  }

  // 将 Markdown 转换为 HTML 元素
  const renderContent = (text: string) => {
    const lines = text.split('\n')
    const elements: React.ReactNode[] = []
    let tableRows: string[][] = []
    let tableHeaders: string[] = []
    let inTable = false

    // 处理表格
    const flushTable = (key: number) => {
      if (tableHeaders.length > 0 || tableRows.length > 0) {
        elements.push(
          <div key={`table-${key}`} className="my-6 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              {tableHeaders.length > 0 && (
                <thead>
                  <tr className="border-b border-[#1E1E2E]">
                    {tableHeaders.map((header, i) => (
                      <th key={i} className="px-4 py-3 text-left text-[#F8F8FC] font-semibold bg-[#1E1E2E]/50">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {tableRows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-b border-[#1E1E2E]/50">
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="px-4 py-3 text-[#9090A0]">
                        {parseInlineMarkdown(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
        tableHeaders = []
        tableRows = []
        inTable = false
      }
    }

    lines.forEach((line, index) => {
      const trimmedLine = line.trim()

      // 检测表格行
      if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
        const cells = trimmedLine.slice(1, -1).split('|').map(c => c.trim())

        // 检测分隔行 (|---|---|)
        if (cells.every(c => /^[-:]+$/.test(c))) {
          // 这是表头分隔行，之前的行应该是表头
          if (!inTable && elements.length > 0) {
            // 移除最后一个元素（它应该是表头）
            const lastElement = elements.pop()
            if (lastElement) {
              // 不做任何操作，tableHeaders 已经设置
            }
          }
          inTable = true
          return
        }

        if (!inTable) {
          // 第一行，作为表头
          tableHeaders = cells
          inTable = true
        } else {
          // 数据行
          tableRows.push(cells)
        }
        return
      }

      // 如果之前在表格中，现在不是表格行了，刷新表格
      if (inTable && (!trimmedLine.startsWith('|') || !trimmedLine.endsWith('|'))) {
        flushTable(index)
      }

      if (trimmedLine.startsWith('# ')) {
        // H1 标题（跳过，因为已经在头部显示）
        return
      } else if (trimmedLine.startsWith('## ')) {
        // 章节标题
        elements.push(
          <h2 key={index} className="text-xl font-bold text-[#F8F8FC] mt-10 mb-4 pb-2 border-b border-[#1E1E2E]">
            {trimmedLine.replace('## ', '')}
          </h2>
        )
      } else if (trimmedLine.startsWith('### ')) {
        // 小节标题
        elements.push(
          <h3 key={index} className="text-lg font-semibold text-[#F8F8FC] mt-6 mb-3">
            {trimmedLine.replace('### ', '')}
          </h3>
        )
      } else if (trimmedLine.startsWith('#### ')) {
        // 子小节标题
        elements.push(
          <h4 key={index} className="text-base font-semibold text-[#F8F8FC] mt-4 mb-2">
            {trimmedLine.replace('#### ', '')}
          </h4>
        )
      } else if (/^\*\*[^*]+\*\*$/.test(trimmedLine)) {
        // 独立的加粗行（如 **重要声明**）
        elements.push(
          <p key={index} className="font-bold text-[#06B6D4] mt-6 mb-3 text-base">
            {trimmedLine.replace(/\*\*/g, '')}
          </p>
        )
      } else if (trimmedLine.startsWith('> ')) {
        // 引用块
        elements.push(
          <blockquote key={index} className="border-l-4 border-[#06B6D4] pl-4 py-2 my-4 bg-[#06B6D4]/5 rounded-r-lg">
            <p className="text-[#9090A0] italic leading-relaxed">
              {parseInlineMarkdown(trimmedLine.replace('> ', ''))}
            </p>
          </blockquote>
        )
      } else if (trimmedLine.startsWith('⚠️ ') || trimmedLine.startsWith('⚠ ')) {
        // 警告提示
        elements.push(
          <div key={index} className="flex items-start gap-3 p-4 my-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
            <span className="text-yellow-400 text-lg">⚠️</span>
            <p className="text-[#9090A0] leading-relaxed">
              {parseInlineMarkdown(trimmedLine.replace(/^⚠️?\s/, ''))}
            </p>
          </div>
        )
      } else if (trimmedLine.startsWith('✅ ') || trimmedLine.startsWith('✓ ')) {
        // 成功/确认项
        elements.push(
          <div key={index} className="flex items-start gap-2 ml-4 mb-2">
            <span className="text-green-400 mt-0.5">✓</span>
            <span className="text-[#9090A0] leading-relaxed">{parseInlineMarkdown(trimmedLine.replace(/^[✅✓]\s/, ''))}</span>
          </div>
        )
      } else if (trimmedLine.startsWith('❌ ') || trimmedLine.startsWith('✗ ')) {
        // 错误/禁止项
        elements.push(
          <div key={index} className="flex items-start gap-2 ml-4 mb-2">
            <span className="text-red-400 mt-0.5">✗</span>
            <span className="text-[#9090A0] leading-relaxed">{parseInlineMarkdown(trimmedLine.replace(/^[❌✗]\s/, ''))}</span>
          </div>
        )
      } else if (trimmedLine.startsWith('- ')) {
        // 无序列表项
        elements.push(
          <li key={index} className="text-[#9090A0] ml-6 mb-1.5 list-disc leading-relaxed">
            {parseInlineMarkdown(trimmedLine.replace('- ', ''))}
          </li>
        )
      } else if (trimmedLine.startsWith('   - ')) {
        // 缩进的子列表项
        elements.push(
          <li key={index} className="text-[#9090A0] ml-12 mb-1 list-[circle] leading-relaxed text-sm">
            {parseInlineMarkdown(trimmedLine.replace('   - ', ''))}
          </li>
        )
      } else if (/^\d+\.\s/.test(trimmedLine)) {
        // 有序列表项
        const content = trimmedLine.replace(/^\d+\.\s/, '')
        elements.push(
          <li key={index} className="text-[#9090A0] ml-6 mb-1.5 list-decimal leading-relaxed">
            {parseInlineMarkdown(content)}
          </li>
        )
      } else if (trimmedLine.startsWith('□ ')) {
        // 复选框项
        elements.push(
          <div key={index} className="flex items-start gap-2 ml-4 mb-2">
            <span className="text-[#06B6D4] mt-0.5">☐</span>
            <span className="text-[#9090A0] leading-relaxed">{trimmedLine.replace('□ ', '')}</span>
          </div>
        )
      } else if (trimmedLine === '---') {
        // 分隔线
        elements.push(
          <hr key={index} className="border-[#1E1E2E] my-8" />
        )
      } else if (trimmedLine.startsWith('©')) {
        // 版权信息
        elements.push(
          <p key={index} className="text-[#606070] text-sm mt-8 text-center">
            {trimmedLine}
          </p>
        )
      } else if (trimmedLine === '') {
        // 空行
        elements.push(<div key={index} className="h-2" />)
      } else {
        // 普通段落
        elements.push(
          <p key={index} className="text-[#9090A0] mb-3 leading-relaxed">
            {parseInlineMarkdown(trimmedLine)}
          </p>
        )
      }
    })

    // 确保最后的表格也被渲染
    if (inTable) {
      flushTable(lines.length)
    }

    return elements
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-[#1E1E2E]">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-[#12121A] rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-[#9090A0]" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#06B6D4]/10 flex items-center justify-center">
                  <IconComponent className="w-5 h-5 text-[#06B6D4]" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">{title}</h1>
                  <div className="flex items-center gap-3 text-xs text-[#606070]">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {document.effectiveDate}
                    </span>
                    <span>v{document.version}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 语言切换 */}
            <div className="flex items-center gap-1 bg-[#12121A] rounded-lg p-1">
              <button
                onClick={() => setLocale('zh')}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  locale === 'zh'
                    ? 'bg-[#06B6D4] text-white'
                    : 'text-[#9090A0] hover:text-white'
                }`}
              >
                中文
              </button>
              <button
                onClick={() => setLocale('en')}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  locale === 'en'
                    ? 'bg-[#06B6D4] text-white'
                    : 'text-[#9090A0] hover:text-white'
                }`}
              >
                EN
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-[#12121A]/80 backdrop-blur-xl border border-[#1E1E2E] rounded-2xl p-6 md:p-8">
          {renderContent(content)}
        </div>

        {/* Bottom Spacer */}
        <div className="h-20 md:h-8" />
      </div>
    </div>
  )
}
