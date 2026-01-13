import { IsString, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// 权限定义
export const PERMISSIONS = {
  // 用户管理
  'users.view': '查看用户',
  'users.edit': '编辑用户',
  'users.ban': '封禁用户',
  'users.reset_password': '重置密码',
  'users.adjust_balance': '调整余额',
  'users.view_api_keys': '查看用户 API Key',
  'users.revoke_api_keys': '撤销 API Key',
  'users.reset_2fa': '重置 2FA',

  // 财务管理
  'finance.view': '查看财务',
  'finance.approve_deposit': '审核充值',
  'finance.approve_withdrawal': '审核提现',
  'finance.adjust_balance': '调整余额',

  // VPS 管理
  'instances.view': '查看 VPS',
  'instances.stop': '停止 VPS',
  'instances.kill_switch': '紧急停机',

  // 策略管理
  'strategies.view': '查看策略',
  'strategies.create': '创建策略',
  'strategies.edit': '编辑策略',
  'strategies.delete': '删除策略',
  'strategies.review': '审核策略',

  // 代理商管理
  'agents.view': '查看代理商',
  'agents.edit': '编辑代理商',
  'agents.approve_withdrawal': '审核代理商提现',
  'agents.promote': '设置代理商',
  'agents.revoke': '撤销代理商',

  // 公告管理
  'announcements.view': '查看公告',
  'announcements.create': '创建公告',
  'announcements.edit': '编辑公告',
  'announcements.delete': '删除公告',

  // CMS 管理
  'cms.view': '查看内容',
  'cms.edit': '编辑内容',
  'cms.banners': '管理横幅',
  'cms.help_docs': '管理帮助文档',
  'cms.popups': '管理弹窗公告',

  // 配置管理
  'configs.view': '查看配置',
  'configs.edit': '编辑配置',
  'configs.brand': '品牌配置',

  // 黑名单管理
  'blacklist.view': '查看黑名单',
  'blacklist.manage': '管理黑名单',

  // 会话管理
  'sessions.view': '查看会话',
  'sessions.revoke': '撤销会话',

  // 审计日志
  'audit.view': '查看审计日志',

  // 报表
  'reports.view': '查看报表',
  'reports.export': '导出报表',

  // 质押管理
  'staking.view': '查看质押',

  // RBAC 管理
  'rbac.view': '查看角色',
  'rbac.manage': '管理角色',
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

// 预设角色
export const PRESET_ROLES = {
  super_admin: {
    name: 'super_admin',
    label: '超级管理员',
    description: '拥有所有权限',
    permissions: Object.keys(PERMISSIONS),
  },
  finance: {
    name: 'finance',
    label: '财务管理员',
    description: '财务相关权限',
    permissions: [
      'users.view',
      'finance.view',
      'finance.approve_deposit',
      'finance.approve_withdrawal',
      'finance.adjust_balance',
      'agents.view',
      'agents.approve_withdrawal',
      'reports.view',
      'reports.export',
      'audit.view',
    ],
  },
  operations: {
    name: 'operations',
    label: '运维管理员',
    description: 'VPS 和系统运维权限',
    permissions: [
      'users.view',
      'instances.view',
      'instances.stop',
      'instances.kill_switch',
      'sessions.view',
      'sessions.revoke',
      'blacklist.view',
      'blacklist.manage',
      'audit.view',
    ],
  },
  content: {
    name: 'content',
    label: '内容编辑',
    description: '公告和内容管理权限',
    permissions: [
      'announcements.view',
      'announcements.create',
      'announcements.edit',
      'announcements.delete',
      'cms.view',
      'cms.edit',
      'cms.banners',
      'cms.help_docs',
      'cms.popups',
    ],
  },
  strategy_reviewer: {
    name: 'strategy_reviewer',
    label: '策略审核员',
    description: '策略审核权限',
    permissions: [
      'strategies.view',
      'strategies.review',
    ],
  },
} as const;

export class CreateRoleDto {
  @ApiProperty({ description: '角色标识' })
  @IsString()
  name: string;

  @ApiProperty({ description: '显示名称' })
  @IsString()
  label: string;

  @ApiPropertyOptional({ description: '描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: '权限列表', type: [String] })
  @IsArray()
  permissions: string[];
}

export class UpdateRoleDto {
  @ApiPropertyOptional({ description: '显示名称' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ description: '描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '权限列表', type: [String] })
  @IsOptional()
  @IsArray()
  permissions?: string[];
}

export class AssignRoleDto {
  @ApiProperty({ description: '用户ID' })
  @IsString()
  userId: string;

  @ApiProperty({ description: '角色ID' })
  @IsString()
  roleId: string;
}

export class RemoveRoleDto {
  @ApiProperty({ description: '用户ID' })
  @IsString()
  userId: string;

  @ApiProperty({ description: '角色ID' })
  @IsString()
  roleId: string;
}
