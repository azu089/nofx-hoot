'use client';

import { cn } from '@/lib/utils';
import { STRATEGY_TEMPLATES, type StrategyTemplate } from '@/lib/strategy-templates';

interface TemplateSelectorProps {
  selectedId: string;
  onSelect: (templateId: string) => void;
  className?: string;
}

/**
 * 横向药丸模板选择器
 * 水平滚动，选中高亮
 */
export function TemplateSelector({ selectedId, onSelect, className }: TemplateSelectorProps) {
  return (
    <div className={cn('relative', className)}>
      {/* 横向滚动容器 */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {STRATEGY_TEMPLATES.map((template) => (
          <TemplatePill
            key={template.id}
            template={template}
            isSelected={selectedId === template.id}
            onSelect={() => onSelect(template.id)}
          />
        ))}
      </div>

      {/* 右侧渐变遮罩（暗示可滚动） */}
      <div className="absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-bg-primary to-transparent pointer-events-none" />
    </div>
  );
}

interface TemplatePillProps {
  template: StrategyTemplate;
  isSelected: boolean;
  onSelect: () => void;
}

function TemplatePill({ template, isSelected, onSelect }: TemplatePillProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex-shrink-0 px-4 py-2.5 rounded-full',
        'border transition-all duration-150',
        'text-sm font-medium whitespace-nowrap',
        isSelected
          ? 'bg-brand-primary border-brand-primary text-white shadow-lg shadow-brand-primary/20'
          : 'bg-bg-secondary border-border-primary text-text-primary hover:border-brand-primary/50 hover:bg-bg-tertiary'
      )}
    >
      {template.name}
    </button>
  );
}
