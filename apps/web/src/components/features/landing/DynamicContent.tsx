'use client';

import { useQuery } from '@tanstack/react-query';
import { publicApi } from '@/lib/api';

interface DynamicContentProps {
  contentKey: string;
  fallback?: React.ReactNode;
  className?: string;
  as?: 'div' | 'span' | 'p' | 'h1' | 'h2' | 'h3';
}

/**
 * 动态内容组件
 * 从 CMS 获取指定 key 的内容
 */
export function DynamicContent({
  contentKey,
  fallback,
  className,
  as: Component = 'div',
}: DynamicContentProps) {
  const { data: contentRes, isLoading, error } = useQuery({
    queryKey: ['cms', 'content', contentKey],
    queryFn: () => publicApi.getContentByKey(contentKey),
    staleTime: 5 * 60 * 1000, // 5 分钟缓存
    retry: false, // 不重试，如果内容不存在就显示 fallback
  });

  // 加载中或出错时显示 fallback
  if (isLoading || error || !contentRes?.data) {
    return fallback ? <Component className={className}>{fallback}</Component> : null;
  }

  const content = contentRes.data;

  // 根据内容类型渲染
  if (content.content_type === 'html') {
    return (
      <Component
        className={className}
        dangerouslySetInnerHTML={{ __html: content.content }}
      />
    );
  }

  // 默认文本类型
  return <Component className={className}>{content.content}</Component>;
}

/**
 * 动态 Markdown 内容组件
 * 用于渲染 Markdown 格式的内容（如帮助文档）
 */
export function DynamicMarkdown({
  contentKey,
  fallback,
  className,
}: Omit<DynamicContentProps, 'as'>) {
  const { data: contentRes, isLoading, error } = useQuery({
    queryKey: ['cms', 'content', contentKey],
    queryFn: () => publicApi.getContentByKey(contentKey),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (isLoading || error || !contentRes?.data) {
    return fallback ? <div className={className}>{fallback}</div> : null;
  }

  // 简单的 Markdown 渲染（实际项目可用 react-markdown）
  const content = contentRes.data.content;

  return (
    <div
      className={`prose prose-invert max-w-none ${className || ''}`}
      dangerouslySetInnerHTML={{
        __html: content
          .replace(/\n/g, '<br />')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>'),
      }}
    />
  );
}

export default DynamicContent;
