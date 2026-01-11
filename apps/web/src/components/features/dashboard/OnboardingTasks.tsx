'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';
import {
  CheckCircle2,
  Circle,
  Key,
  Wallet,
  Zap,
  Bot,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface OnboardingTask {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  checkKey: string; // localStorage key for completion status
  points: number; // 完成获得的积分
}

const tasks: OnboardingTask[] = [
  {
    id: 'bind-api',
    title: '绑定交易所 API',
    description: '连接你的交易所账户',
    icon: Key,
    href: '/wallet/api-keys',
    checkKey: 'onboarding_api_bound',
    points: 5,
  },
  {
    id: 'first-deposit',
    title: '首次充值 ≥50U',
    description: '充值 USDT 开始交易',
    icon: Wallet,
    href: '/wallet/deposit',
    checkKey: 'onboarding_first_deposit',
    points: 20,
  },
  {
    id: 'subscribe-strategy',
    title: '订阅付费策略',
    description: '选择适合你的量化策略',
    icon: Zap,
    href: '/strategies',
    checkKey: 'onboarding_strategy_subscribed',
    points: 15,
  },
  {
    id: 'start-bot',
    title: '运行机器人 24h',
    description: '让 AI 为你自动交易',
    icon: Bot,
    href: '/trading',
    checkKey: 'onboarding_bot_started',
    points: 10,
  },
];

export function OnboardingTasks() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);

  // 从 localStorage 加载完成状态
  useEffect(() => {
    const completed = new Set<string>();
    tasks.forEach((task) => {
      if (localStorage.getItem(task.checkKey) === 'true') {
        completed.add(task.id);
      }
    });
    setCompletedTasks(completed);
    setIsLoaded(true);
  }, []);

  // 计算进度
  const completedCount = completedTasks.size;
  const totalCount = tasks.length;
  const progress = (completedCount / totalCount) * 100;
  const totalPoints = tasks.reduce((sum, t) => sum + t.points, 0);
  const earnedPoints = tasks
    .filter((t) => completedTasks.has(t.id))
    .reduce((sum, t) => sum + t.points, 0);

  // 如果全部完成，不显示
  if (isLoaded && completedCount === totalCount) {
    return null;
  }

  // 处理任务点击
  const handleTaskClick = (task: OnboardingTask) => {
    router.push(task.href);
  };

  return (
    <Card variant="glass">
      <CardContent className="p-4">
        {/* 标题与进度 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-warning" />
            <span className="text-sm font-medium text-text-primary">新手任务</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-tertiary">
              {completedCount}/{totalCount}
            </span>
            <span className="text-xs text-warning font-medium">
              +{earnedPoints}/{totalPoints} 积分
            </span>
          </div>
        </div>

        {/* 进度条 */}
        <div className="h-1.5 bg-bg-tertiary rounded-full mb-4 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-primary to-brand-secondary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* 任务列表 */}
        <div className="space-y-2">
          {tasks.map((task) => {
            const isCompleted = completedTasks.has(task.id);
            const Icon = task.icon;

            return (
              <button
                key={task.id}
                onClick={() => handleTaskClick(task)}
                disabled={isCompleted}
                className={`
                  w-full flex items-center gap-3 p-3 rounded-xl transition-all
                  ${isCompleted
                    ? 'bg-success/10 cursor-default'
                    : 'bg-bg-tertiary/30 hover:bg-bg-tertiary/50 cursor-pointer'
                  }
                `}
              >
                {/* 状态图标 */}
                <div
                  className={`
                    w-8 h-8 rounded-lg flex items-center justify-center
                    ${isCompleted ? 'bg-success/20' : 'bg-brand-primary/20'}
                  `}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  ) : (
                    <Icon className="w-4 h-4 text-brand-primary" />
                  )}
                </div>

                {/* 任务信息 */}
                <div className="flex-1 text-left">
                  <p
                    className={`text-sm font-medium ${
                      isCompleted ? 'text-success line-through' : 'text-text-primary'
                    }`}
                  >
                    {task.title}
                  </p>
                  <p className="text-xs text-text-tertiary">{task.description}</p>
                </div>

                {/* 积分 & 箭头 */}
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-medium ${
                      isCompleted ? 'text-success' : 'text-warning'
                    }`}
                  >
                    +{task.points}
                  </span>
                  {!isCompleted && (
                    <ChevronRight className="w-4 h-4 text-text-tertiary" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
