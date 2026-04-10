import React from 'react'
import { Check } from 'lucide-react'

interface ModelStepIndicatorProps {
  currentStep: number
  labels: string[]
}

export function ModelStepIndicator({ currentStep, labels }: ModelStepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {labels.map((label, index) => {
        const isDone = index < currentStep
        const isActive = index === currentStep
        return (
          <React.Fragment key={index}>
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  isDone || isActive
                    ? 'bg-emerald-400 text-black shadow-[0_0_16px_rgba(43,232,158,0.4)]'
                    : 'bg-white/5 text-zinc-500 border border-white/10'
                }`}
              >
                {isDone ? <Check className="w-4 h-4" strokeWidth={3} /> : index + 1}
              </div>
              <span
                className={`text-xs font-medium hidden sm:block ${isActive ? 'text-zinc-100' : 'text-zinc-500'}`}
              >
                {label}
              </span>
            </div>
            {index < labels.length - 1 && (
              <div className={`w-8 h-0.5 mx-1 ${isDone ? 'bg-emerald-400' : 'bg-white/10'}`} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}
