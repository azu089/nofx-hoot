'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Clock, Eye, Tag, AlertCircle } from 'lucide-react';
import { publicApi } from '@/lib/api';

export default function HelpDocDetailPage() {
  const params = useParams();
  const slug = params.slug as string;

  const { data: docRes, isLoading, error } = useQuery({
    queryKey: ['cms', 'help-doc', slug],
    queryFn: () => publicApi.getHelpDocBySlug(slug),
    enabled: !!slug,
    retry: false,
  });

  const doc = docRes?.data;

  return (
    <div className="min-h-screen bg-bg-primary text-white">
      {/* Header */}
      <header className="border-b border-border-primary bg-bg-secondary">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/help"
            className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            返回帮助中心
          </Link>
          <Link
            href="/login"
            className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary transition-colors"
          >
            登录
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-text-secondary mt-4">加载中...</p>
          </div>
        ) : error || !doc ? (
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-danger mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">文档不存在</h1>
            <p className="text-text-secondary mb-6">
              抱歉，您访问的帮助文档不存在或已被删除
            </p>
            <Link
              href="/help"
              className="inline-flex items-center gap-2 px-6 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              返回帮助中心
            </Link>
          </div>
        ) : (
          <article>
            {/* 文档头部 */}
            <header className="mb-8">
              <div className="flex items-center gap-2 text-sm text-text-secondary mb-4">
                <span className="px-2 py-1 bg-bg-tertiary rounded">
                  {doc.category === 'faq'
                    ? '常见问题'
                    : doc.category === 'tutorial'
                    ? '使用教程'
                    : '操作指南'}
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-4">
                {doc.title}
              </h1>
              {doc.summary && (
                <p className="text-xl text-text-secondary">{doc.summary}</p>
              )}
              {doc.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  <Tag className="w-4 h-4 text-text-tertiary" />
                  {doc.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-bg-tertiary text-text-secondary text-sm rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </header>

            {/* 文档内容 */}
            <div
              className="prose prose-invert max-w-none
                prose-headings:text-white prose-headings:font-bold
                prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4
                prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3
                prose-p:text-text-primary prose-p:leading-relaxed
                prose-a:text-brand-primary prose-a:no-underline hover:prose-a:underline
                prose-strong:text-white
                prose-code:bg-bg-tertiary prose-code:text-success prose-code:px-1 prose-code:rounded
                prose-pre:bg-bg-tertiary prose-pre:border prose-pre:border-border-primary
                prose-ul:text-text-primary prose-ol:text-text-primary
                prose-li:marker:text-text-tertiary
              "
              dangerouslySetInnerHTML={{
                __html: formatMarkdown(doc.content),
              }}
            />

            {/* 底部导航 */}
            <footer className="mt-12 pt-8 border-t border-border-primary">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-text-tertiary text-sm">
                  这篇文章对您有帮助吗？
                </p>
                <div className="flex gap-3">
                  <button className="px-4 py-2 bg-success/10 text-success rounded-lg hover:bg-success/20 transition-colors">
                    有帮助
                  </button>
                  <button className="px-4 py-2 bg-danger/10 text-danger rounded-lg hover:bg-danger/20 transition-colors">
                    没帮助
                  </button>
                </div>
              </div>
            </footer>
          </article>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border-primary py-8 px-4 mt-auto">
        <div className="max-w-4xl mx-auto text-center text-text-tertiary text-sm">
          <p>找不到您需要的帮助？请联系客服支持。</p>
          <p className="mt-2">© 2025 QuantFi. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

// 简单的 Markdown 格式化
function formatMarkdown(content: string): string {
  return content
    // 标题
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // 粗体和斜体
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // 代码块
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    // 行内代码
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // 链接
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // 无序列表
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    // 有序列表
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // 段落
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$/gm, (match) => {
      if (
        match.startsWith('<h') ||
        match.startsWith('<ul') ||
        match.startsWith('<ol') ||
        match.startsWith('<li') ||
        match.startsWith('<pre')
      ) {
        return match;
      }
      return `<p>${match}</p>`;
    })
    // 清理多余的空 p 标签
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<h|<ul|<ol|<pre)/g, '$1')
    .replace(/(<\/h\d>|<\/ul>|<\/ol>|<\/pre>)<\/p>/g, '$1');
}
