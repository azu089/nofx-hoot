'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  HelpCircle,
  BookOpen,
  FileText,
  ChevronRight,
  Search,
  ArrowLeft,
} from 'lucide-react';
import { publicApi } from '@/lib/api';

const categoryIcons: Record<string, any> = {
  faq: HelpCircle,
  tutorial: BookOpen,
  guide: FileText,
};

const categoryLabels: Record<string, string> = {
  faq: '常见问题',
  tutorial: '使用教程',
  guide: '操作指南',
};

export default function HelpCenterPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: docsRes, isLoading } = useQuery({
    queryKey: ['cms', 'help-docs', activeCategory],
    queryFn: () => publicApi.getHelpDocs(activeCategory || undefined),
    staleTime: 5 * 60 * 1000,
  });

  const docs = docsRes?.data || [];

  // 过滤搜索结果
  const filteredDocs = searchTerm
    ? docs.filter(
        (doc) =>
          doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (doc.summary?.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : docs;

  // 按分类分组
  const categories = ['faq', 'tutorial', 'guide'];
  const groupedDocs = categories.reduce((acc, cat) => {
    acc[cat] = filteredDocs.filter((doc) => doc.category === cat);
    return acc;
  }, {} as Record<string, typeof docs>);

  return (
    <div className="min-h-screen bg-bg-primary text-white">
      {/* Header */}
      <header className="border-b border-border-primary bg-bg-secondary">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            返回首页
          </Link>
          <Link
            href="/login"
            className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary transition-colors"
          >
            登录
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 px-4 bg-gradient-to-b from-bg-secondary to-transparent">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">帮助中心</h1>
          <p className="text-text-secondary mb-8">
            快速找到您需要的帮助和指南
          </p>

          {/* 搜索框 */}
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
            <input
              type="text"
              placeholder="搜索帮助文档..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white placeholder-text-tertiary focus:outline-none focus:border-brand-primary"
            />
          </div>
        </div>
      </section>

      {/* 分类标签 */}
      <section className="px-4 pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeCategory === null
                  ? 'bg-brand-primary text-white'
                  : 'bg-bg-tertiary text-text-secondary hover:text-white'
              }`}
            >
              全部
            </button>
            {categories.map((cat) => {
              const Icon = categoryIcons[cat] || FileText;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                    activeCategory === cat
                      ? 'bg-brand-primary text-white'
                      : 'bg-bg-tertiary text-text-secondary hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {categoryLabels[cat]}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 文档列表 */}
      <section className="px-4 pb-16">
        <div className="max-w-6xl mx-auto">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-text-secondary mt-4">加载中...</p>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-center py-12">
              <HelpCircle className="w-16 h-16 text-text-disabled mx-auto mb-4" />
              <p className="text-text-secondary">
                {searchTerm ? '未找到匹配的文档' : '暂无帮助文档'}
              </p>
            </div>
          ) : activeCategory ? (
            // 单分类显示
            <div className="grid gap-4">
              {filteredDocs.map((doc) => (
                <DocCard key={doc.id} doc={doc} />
              ))}
            </div>
          ) : (
            // 分组显示
            <div className="space-y-12">
              {categories.map((cat) => {
                const catDocs = groupedDocs[cat];
                if (catDocs.length === 0) return null;

                const Icon = categoryIcons[cat] || FileText;
                return (
                  <div key={cat}>
                    <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                      <Icon className="w-5 h-5 text-brand-primary" />
                      {categoryLabels[cat]}
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      {catDocs.map((doc) => (
                        <DocCard key={doc.id} doc={doc} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-primary py-8 px-4">
        <div className="max-w-6xl mx-auto text-center text-text-tertiary text-sm">
          <p>找不到您需要的帮助？请联系客服支持。</p>
          <p className="mt-2">© 2025 QuantFi. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

// 文档卡片组件
function DocCard({ doc }: { doc: { id: string; title: string; slug: string; summary: string | null; tags: string[] } }) {
  return (
    <Link
      href={`/help/${doc.slug}`}
      className="block bg-bg-secondary rounded-xl p-6 border border-border-primary hover:border-brand-primary transition-colors group"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white group-hover:text-brand-primary transition-colors mb-2">
            {doc.title}
          </h3>
          {doc.summary && (
            <p className="text-text-secondary text-sm line-clamp-2">{doc.summary}</p>
          )}
          {doc.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {doc.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-bg-tertiary text-text-secondary text-xs rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <ChevronRight className="w-5 h-5 text-text-disabled group-hover:text-brand-primary transition-colors flex-shrink-0 ml-4" />
      </div>
    </Link>
  );
}
