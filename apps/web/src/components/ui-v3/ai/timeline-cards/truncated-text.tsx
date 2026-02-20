'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslations } from '@/i18n/provider';

interface TruncatedTextProps {
  text: string;
  maxLines?: number;
  className?: string;
}

export function TruncatedText({ text, maxLines = 3, className = '' }: TruncatedTextProps) {
  const t = useTranslations('ai');
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    // 检测文本是否被截断
    setIsClamped(el.scrollHeight > el.clientHeight + 1);
  }, [text, maxLines]);

  return (
    <div className={className}>
      <div
        ref={textRef}
        className="text-[#9090A0] text-xs leading-relaxed whitespace-pre-wrap break-words"
        style={
          expanded
            ? undefined
            : {
                display: '-webkit-box',
                WebkitLineClamp: maxLines,
                WebkitBoxOrient: 'vertical' as const,
                overflow: 'hidden',
              }
        }
      >
        {text}
      </div>
      {isClamped && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="flex items-center gap-0.5 text-[10px] text-[#06B6D4] mt-1 hover:text-[#0891B2] transition-colors"
        >
          {expanded ? (
            <>{t('common.collapse')} <ChevronUp className="w-3 h-3" /></>
          ) : (
            <>{t('common.expand')} <ChevronDown className="w-3 h-3" /></>
          )}
        </button>
      )}
    </div>
  );
}
