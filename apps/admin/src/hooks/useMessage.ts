/**
 * useMessage - 获取 Ant Design App 上下文中的 message 实例
 * 解决 "Static function can not consume context" 警告
 */
import { App } from 'antd';

export const useMessage = () => {
  const { message } = App.useApp();
  return message;
};

export const useNotification = () => {
  const { notification } = App.useApp();
  return notification;
};

export const useModal = () => {
  const { modal } = App.useApp();
  return modal;
};
