/**
 * 代理商认证服务
 * 处理代理商登录、Token 生成等
 */
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AgentAuthService {
  private readonly logger = new Logger(AgentAuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // 代理商登录
  async login(email: string, password: string) {
    // 查找代理商
    const agent = await this.prisma.agent.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        status: true,
        isActive: true,
        level: true,
        commissionRate: true,
      },
    });

    if (!agent) {
      this.logger.warn(`代理商登录失败: 邮箱不存在 ${email}`);
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, agent.password);
    if (!isPasswordValid) {
      this.logger.warn(`代理商登录失败: 密码错误 ${email}`);
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // 检查状态
    if (agent.status !== 'active' || !agent.isActive) {
      this.logger.warn(
        `代理商登录失败: 账号未激活 ${email}, status=${agent.status}`,
      );
      throw new UnauthorizedException('账号未激活或已被禁用，请联系管理员');
    }

    // 生成 Token
    const token = this.jwtService.sign({
      sub: agent.id,
      email: agent.email,
      type: 'agent',
    });

    // 更新最后登录时间
    await this.prisma.agent.update({
      where: { id: agent.id },
      data: { lastLoginAt: new Date() },
    });

    this.logger.log(`代理商登录成功: ${agent.name} (${agent.email})`);

    return {
      token,
      agent: {
        id: agent.id,
        email: agent.email,
        name: agent.name,
        level: agent.level,
        commissionRate: agent.commissionRate.toString(),
      },
    };
  }

  // 获取当前代理商信息
  async getProfile(agentId: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        companyName: true,
        level: true,
        commissionRate: true,
        settlementType: true,
        walletAddress: true,
        status: true,
        totalUsers: true,
        totalProfit: true,
        totalCommission: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    if (!agent) {
      throw new UnauthorizedException('代理商不存在');
    }

    return {
      ...agent,
      commissionRate: agent.commissionRate.toString(),
      totalProfit: agent.totalProfit.toString(),
      totalCommission: agent.totalCommission.toString(),
    };
  }

  // 修改密码
  async changePassword(
    agentId: string,
    oldPassword: string,
    newPassword: string,
  ) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: { id: true, password: true },
    });

    if (!agent) {
      throw new UnauthorizedException('代理商不存在');
    }

    // 验证旧密码
    const isPasswordValid = await bcrypt.compare(oldPassword, agent.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('原密码错误');
    }

    // 更新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.agent.update({
      where: { id: agentId },
      data: { password: hashedPassword },
    });

    this.logger.log(`代理商修改密码成功: ${agentId}`);

    return { message: '密码修改成功' };
  }

  // 更新结算账户
  async updateSettlementAccount(
    agentId: string,
    data: {
      walletAddress?: string;
    },
  ) {
    await this.prisma.agent.update({
      where: { id: agentId },
      data: {
        walletAddress: data.walletAddress,
      },
    });

    return { message: '结算账户更新成功' };
  }
}
