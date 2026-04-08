import { Check } from 'lucide-react'
import type { AIModel } from '../../types'
import { getModelIcon } from '../common/ModelIcons'
import { getShortName } from './model-constants'

interface ModelCardProps {
  model: AIModel
  selected: boolean
  onClick: () => void
  configured?: boolean
}

export function ModelCard({ model, selected, onClick, configured }: ModelCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-2 p-2 rounded-xl transition-all hover:bg-white/[0.04]"
    >
      <div className="relative">
        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
            selected
              ? 'ring-2 ring-emerald-400 shadow-[0_0_20px_rgba(43,232,158,0.4)]'
              : 'ring-1 ring-white/10 group-hover:ring-white/20'
          }`}
          style={{ background: 'rgba(0, 0, 0, 0.3)' }}
        >
          {getModelIcon(model.provider || model.id, { width: 32, height: 32 }) || (
            <span className="text-lg font-medium text-zinc-300">{model.name[0]}</span>
          )}
        </div>
        {selected && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center bg-emerald-400 shadow-[0_0_10px_rgba(43,232,158,0.6)]">
            <Check className="w-3 h-3 text-black" strokeWidth={3} />
          </div>
        )}
        {configured && !selected && (
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center bg-emerald-500/80">
            <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />
          </div>
        )}
      </div>
      <span className={`text-xs font-medium text-center leading-tight ${selected ? 'text-white' : 'text-zinc-300'}`}>
        {getShortName(model.name)}
      </span>
    </button>
  )
}
