'use client';

import { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STRATEGY_TEMPLATES, type StrategyTemplate } from '@/lib/strategy-templates';

interface TemplateSelectorProps {
  selectedId: string;
  onSelect: (templateId: string) => void;
  className?: string;
}

/**
 * 折叠式模板选择器
 * 点击展开所有模板，选择后自动收起
 */
export function TemplateSelector({ selectedId, onSelect, className }: TemplateSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const selectedTemplate = STRATEGY_TEMPLATES.find(t => t.id === selectedId);

  const handleSelect = (templateId: string) => {
    onSelect(templateId);
    setIsExpanded(false);
  };

  return (
    <div className={cn('relative', className)}>
      {/* 收起状态 - 显示当前选中的模板 */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center justify-between',
          'px-4 py-3 rounded-xl',
          'bg-[#000000] lg:bg-bg-tertiary',
          'text-left transition-all duration-200',
          isExpanded && 'rounded-b-none'
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center',
            'bg-brand-primary/20 text-brand-primary'
          )}>
            <Check className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm text-text-tertiary">当前模板</div>
            <div className="text-text-primary font-medium">
              {selectedTemplate?.name || '选择模板'}
            </div>
          </div>
        </div>
        <ChevronDown
          className={cn(
            'w-5 h-5 text-text-tertiary transition-transform duration-200',
            isExpanded && 'rotate-180'
          )}
        />
      </button>

      {/* 展开状态 - 显示所有模板 */}
      {isExpanded && (
        <div className={cn(
          'absolute left-0 right-0 z-20',
          'bg-[#000000] lg:bg-bg-tertiary',
          'rounded-b-xl',
          'lg:border-t lg:border-border-primary/20',
          'shadow-xl shadow-black/50',
          'overflow-hidden'
        )}>
          <div className="max-h-[300px] overflow-y-auto">
            {STRATEGY_TEMPLATES.map((template, index) => (
              <TemplateOption
                key={template.id}
                template={template}
                isSelected={selectedId === template.id}
                onSelect={() => handleSelect(template.id)}
                isLast={index === STRATEGY_TEMPLATES.length - 1}
              />
            ))}
          </div>
        </div>
      )}

      {/* 点击外部关闭 */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setIsExpanded(false)}
        />
      )}
    </div>
  );
}

interface TemplateOptionProps {
  template: StrategyTemplate;
  isSelected: boolean;
  onSelect: () => void;
  isLast: boolean;
}

function TemplateOption({ template, isSelected, onSelect, isLast }: TemplateOptionProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3',
        'text-left transition-colors duration-150',
        'hover:bg-white/5',
        isSelected && 'bg-brand-primary/10',
        !isLast && 'lg:border-b lg:border-border-primary/10'
      )}
    >
      <div className={cn(
        'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
        'border-2 transition-colors',
        isSelected
          ? 'bg-brand-primary border-brand-primary'
          : 'border-border-primary'
      )}>
        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className={cn(
          'font-medium truncate',
          isSelected ? 'text-brand-primary' : 'text-text-primary'
        )}>
          {template.name}
        </div>
        {template.description && (
          <div className="text-xs text-text-tertiary truncate mt-0.5">
            {template.description}
          </div>
        )}
      </div>
    </button>
  );
}
