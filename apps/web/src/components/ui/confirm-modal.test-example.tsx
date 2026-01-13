/**
 * ConfirmModal 集成测试示例
 *
 * 此文件演示如何在实际项目中使用 ConfirmModal 组件
 * 可以将此代码复制到任何页面中测试
 */

'use client';

import { useState } from 'react';
import { ConfirmModal } from './confirm-modal';
import { useToast } from './toast';
import { Button } from './button';

export function ConfirmModalTestExample() {
  const [showDefault, setShowDefault] = useState(false);
  const [showDanger, setShowDanger] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showNone, setShowNone] = useState(false);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  // 模拟异步操作
  const mockAsyncOperation = () => {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, 2000);
    });
  };

  // 默认样式确认
  const handleDefaultConfirm = async () => {
    setLoading(true);
    try {
      await mockAsyncOperation();
      toast.success('操作成功');
      setShowDefault(false);
    } catch (error) {
      toast.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  // 危险操作确认（平仓）
  const handleDangerConfirm = async () => {
    setLoading(true);
    try {
      await mockAsyncOperation();
      toast.success('已触发紧急平仓');
      setShowDanger(false);
    } catch (error) {
      toast.error('平仓失败');
    } finally {
      setLoading(false);
    }
  };

  // 信息样式确认
  const handleInfoConfirm = async () => {
    setLoading(true);
    try {
      await mockAsyncOperation();
      toast.success('策略已启动');
      setShowInfo(false);
    } catch (error) {
      toast.error('启动失败');
    } finally {
      setLoading(false);
    }
  };

  // 无图标样式确认
  const handleNoneConfirm = async () => {
    setLoading(true);
    try {
      await mockAsyncOperation();
      toast.success('提交成功');
      setShowNone(false);
    } catch (error) {
      toast.error('提交失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-4">
      <h2 className="text-2xl font-bold text-text-primary mb-6">ConfirmModal 测试示例</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. 默认样式 */}
        <div className="p-6 bg-bg-secondary rounded-lg border border-border-primary">
          <h3 className="text-lg font-semibold text-text-primary mb-2">默认样式</h3>
          <p className="text-sm text-text-secondary mb-4">
            蓝色确认按钮 + 警告图标，适用于普通确认操作
          </p>
          <Button onClick={() => setShowDefault(true)}>测试默认样式</Button>

          <ConfirmModal
            open={showDefault}
            onOpenChange={setShowDefault}
            title="确认删除？"
            description="此操作不可撤销，请谨慎操作"
            confirmText="确认删除"
            cancelText="取消"
            variant="default"
            icon="warning"
            loading={loading}
            onConfirm={handleDefaultConfirm}
          />
        </div>

        {/* 2. 危险样式 */}
        <div className="p-6 bg-bg-secondary rounded-lg border border-border-primary">
          <h3 className="text-lg font-semibold text-text-primary mb-2">危险样式</h3>
          <p className="text-sm text-text-secondary mb-4">
            红色确认按钮 + 警告图标，适用于危险操作（平仓、删除等）
          </p>
          <Button variant="danger" onClick={() => setShowDanger(true)}>
            测试危险样式
          </Button>

          <ConfirmModal
            open={showDanger}
            onOpenChange={setShowDanger}
            title="确认平仓？"
            description="此操作将关闭所有持仓，不可撤销"
            confirmText="确认平仓"
            cancelText="取消"
            variant="danger"
            icon="warning"
            loading={loading}
            onConfirm={handleDangerConfirm}
          />
        </div>

        {/* 3. 信息样式 */}
        <div className="p-6 bg-bg-secondary rounded-lg border border-border-primary">
          <h3 className="text-lg font-semibold text-text-primary mb-2">信息样式</h3>
          <p className="text-sm text-text-secondary mb-4">
            蓝色确认按钮 + 信息图标，适用于普通提示操作
          </p>
          <Button onClick={() => setShowInfo(true)}>测试信息样式</Button>

          <ConfirmModal
            open={showInfo}
            onOpenChange={setShowInfo}
            title="启动策略"
            description="确认启动该策略？系统将开始自动交易"
            confirmText="启动"
            cancelText="取消"
            variant="default"
            icon="info"
            loading={loading}
            onConfirm={handleInfoConfirm}
          />
        </div>

        {/* 4. 无图标样式 */}
        <div className="p-6 bg-bg-secondary rounded-lg border border-border-primary">
          <h3 className="text-lg font-semibold text-text-primary mb-2">无图标样式</h3>
          <p className="text-sm text-text-secondary mb-4">
            无图标，适用于简洁场景
          </p>
          <Button onClick={() => setShowNone(true)}>测试无图标样式</Button>

          <ConfirmModal
            open={showNone}
            onOpenChange={setShowNone}
            title="确认提交？"
            description="请确认所有信息填写正确"
            confirmText="提交"
            cancelText="取消"
            variant="default"
            icon="none"
            loading={loading}
            onConfirm={handleNoneConfirm}
          />
        </div>
      </div>

      <div className="mt-8 p-4 bg-bg-tertiary rounded-lg border border-border-primary">
        <h3 className="text-sm font-semibold text-text-primary mb-2">功能测试说明</h3>
        <ul className="text-sm text-text-secondary space-y-1">
          <li>✅ 点击按钮触发对应弹窗</li>
          <li>✅ 点击遮罩层关闭弹窗（非加载状态）</li>
          <li>✅ 按 ESC 键关闭弹窗（非加载状态）</li>
          <li>✅ 点击确认按钮，显示 2 秒 loading 动画</li>
          <li>✅ 操作成功后显示 Toast 提示并关闭弹窗</li>
          <li>✅ 加载状态下禁止关闭弹窗和重复点击</li>
        </ul>
      </div>
    </div>
  );
}
