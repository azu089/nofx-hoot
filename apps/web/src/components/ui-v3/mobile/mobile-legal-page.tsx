'use client'

import { useState } from 'react'
import {
  ArrowLeft,
  AlertTriangle,
} from 'lucide-react'
import { legalDocuments, type LegalDocumentContent } from '@/lib/legal-content'

interface MobileLegalPageProps {
  slug: 'terms' | 'privacy' | 'risk'
  onBack?: () => void
}

export function MobileLegalPage({ slug, onBack }: MobileLegalPageProps) {
  const [locale, setLocale] = useState<'zh' | 'en'>('zh')
  const document: LegalDocumentContent | undefined = legalDocuments[slug]

  if (!document) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-[#606070] mx-auto mb-4" />
          <p className="text-[#94A3B8]">文档不存在</p>
          <button
            type="button"
            onClick={onBack}
            className="mt-4 px-4 py-2 bg-cyan-500 text-white rounded-xl"
          >
            返回
          </button>
        </div>
      </div>
    )
  }

  const title = locale === 'zh' ? document.titleZh : document.titleEn
  const content = locale === 'zh' ? document.contentZh : document.contentEn

  // 解析内联 Markdown
  const parseInlineMarkdown = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = []
    const regex = /\*\*(.*?)\*\*/g
    let lastIndex = 0
    let match

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index))
      }
      parts.push(
        <strong key={match.index} className="text-white font-semibold">
          {match[1]}
        </strong>
      )
      lastIndex = regex.lastIndex
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex))
    }

    return parts.length > 0 ? parts : text
  }

  // Markdown 渲染
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
          <div key={`table-${key}`} className="my-4 overflow-x-auto -mx-2">
            <table className="w-full text-xs border-collapse min-w-[300px]">
              {tableHeaders.length > 0 && (
                <thead>
                  <tr className="border-b border-[#1E1E2E]">
                    {tableHeaders.map((header, i) => (
                      <th key={i} className="px-3 py-2 text-left text-white font-semibold bg-[#1E1E2E]/50">
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
                      <td key={cellIndex} className="px-3 py-2 text-[#94A3B8]">
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
          inTable = true
          return
        }

        if (!inTable) {
          tableHeaders = cells
          inTable = true
        } else {
          tableRows.push(cells)
        }
        return
      }

      // 如果之前在表格中，现在不是表格行了，刷新表格
      if (inTable && (!trimmedLine.startsWith('|') || !trimmedLine.endsWith('|'))) {
        flushTable(index)
      }

      if (trimmedLine.startsWith('# ')) {
        return
      } else if (trimmedLine.startsWith('## ')) {
        elements.push(
          <h2 key={index} className="text-lg font-bold text-white mt-8 mb-3 pb-2 border-b border-[#1E1E2E]">
            {trimmedLine.replace('## ', '')}
          </h2>
        )
      } else if (trimmedLine.startsWith('### ')) {
        elements.push(
          <h3 key={index} className="text-base font-semibold text-white mt-5 mb-2">
            {trimmedLine.replace('### ', '')}
          </h3>
        )
      } else if (trimmedLine.startsWith('#### ')) {
        elements.push(
          <h4 key={index} className="text-sm font-semibold text-white mt-4 mb-2">
            {trimmedLine.replace('#### ', '')}
          </h4>
        )
      } else if (/^\*\*[^*]+\*\*$/.test(trimmedLine)) {
        elements.push(
          <p key={index} className="font-bold text-cyan-500 mt-5 mb-2 text-sm">
            {trimmedLine.replace(/\*\*/g, '')}
          </p>
        )
      } else if (trimmedLine.startsWith('> ')) {
        // 引用块
        elements.push(
          <blockquote key={index} className="border-l-3 border-cyan-500 pl-3 py-1.5 my-3 bg-cyan-500/5 rounded-r-lg">
            <p className="text-[#94A3B8] italic text-sm leading-relaxed">
              {parseInlineMarkdown(trimmedLine.replace('> ', ''))}
            </p>
          </blockquote>
        )
      } else if (trimmedLine.startsWith('⚠️ ') || trimmedLine.startsWith('⚠ ')) {
        // 警告提示
        elements.push(
          <div key={index} className="flex items-start gap-2 p-3 my-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
            <span className="text-yellow-400 text-sm">⚠️</span>
            <p className="text-[#94A3B8] text-sm leading-relaxed">
              {parseInlineMarkdown(trimmedLine.replace(/^⚠️?\s/, ''))}
            </p>
          </div>
        )
      } else if (trimmedLine.startsWith('✅ ') || trimmedLine.startsWith('✓ ')) {
        elements.push(
          <div key={index} className="flex items-start gap-2 ml-3 mb-1.5">
            <span className="text-green-400 mt-0.5 text-sm">✓</span>
            <span className="text-[#94A3B8] text-sm leading-relaxed">{parseInlineMarkdown(trimmedLine.replace(/^[✅✓]\s/, ''))}</span>
          </div>
        )
      } else if (trimmedLine.startsWith('❌ ') || trimmedLine.startsWith('✗ ')) {
        elements.push(
          <div key={index} className="flex items-start gap-2 ml-3 mb-1.5">
            <span className="text-red-400 mt-0.5 text-sm">✗</span>
            <span className="text-[#94A3B8] text-sm leading-relaxed">{parseInlineMarkdown(trimmedLine.replace(/^[❌✗]\s/, ''))}</span>
          </div>
        )
      } else if (trimmedLine.startsWith('- ')) {
        elements.push(
          <li key={index} className="text-[#94A3B8] ml-5 mb-1 list-disc text-sm leading-relaxed">
            {parseInlineMarkdown(trimmedLine.replace('- ', ''))}
          </li>
        )
      } else if (trimmedLine.startsWith('   - ')) {
        // 缩进的子列表项
        elements.push(
          <li key={index} className="text-[#94A3B8] ml-10 mb-0.5 list-[circle] text-xs leading-relaxed">
            {parseInlineMarkdown(trimmedLine.replace('   - ', ''))}
          </li>
        )
      } else if (/^\d+\.\s/.test(trimmedLine)) {
        const content = trimmedLine.replace(/^\d+\.\s/, '')
        elements.push(
          <li key={index} className="text-[#94A3B8] ml-5 mb-1 list-decimal text-sm leading-relaxed">
            {parseInlineMarkdown(content)}
          </li>
        )
      } else if (trimmedLine.startsWith('□ ')) {
        elements.push(
          <div key={index} className="flex items-start gap-2 ml-3 mb-2">
            <span className="text-cyan-500 mt-0.5 text-sm">☐</span>
            <span className="text-[#94A3B8] text-sm leading-relaxed">{trimmedLine.replace('□ ', '')}</span>
          </div>
        )
      } else if (trimmedLine === '---') {
        elements.push(
          <hr key={index} className="border-[#1E1E2E] my-6" />
        )
      } else if (trimmedLine.startsWith('©')) {
        elements.push(
          <p key={index} className="text-[#606070] text-xs mt-6 text-center">
            {trimmedLine}
          </p>
        )
      } else if (trimmedLine === '') {
        elements.push(<div key={index} className="h-1.5" />)
      } else {
        elements.push(
          <p key={index} className="text-[#94A3B8] mb-2 text-sm leading-relaxed">
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
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-8">
      {/* 顶部导航栏 */}
      <div className="sticky top-0 z-50 bg-[#0A0A0F]/95 backdrop-blur-lg border-b border-[#1E1E2E]">
        <div className="flex items-center justify-between px-4 h-14">
          <button
            type="button"
            onClick={onBack}
            aria-label="返回"
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#12121A] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>

          <h1 className="text-base font-semibold text-white">{title}</h1>

          {/* 语言切换 */}
          <div className="flex items-center gap-0.5 bg-[#12121A] rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setLocale('zh')}
              className={`px-2 py-1 rounded-md text-xs transition-colors ${
                locale === 'zh'
                  ? 'bg-cyan-500 text-white'
                  : 'text-[#94A3B8]'
              }`}
            >
              中
            </button>
            <button
              type="button"
              onClick={() => setLocale('en')}
              className={`px-2 py-1 rounded-md text-xs transition-colors ${
                locale === 'en'
                  ? 'bg-cyan-500 text-white'
                  : 'text-[#94A3B8]'
              }`}
            >
              EN
            </button>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="px-4 pt-4">
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4">
          {renderContent(content)}
        </div>
      </div>
    </div>
  )
}
