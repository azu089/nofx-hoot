/**
 * 代理商认证控制器
 * 处理代理商登录、个人信息等
 */
import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { AgentAuthService } from './agent-auth.service';
import { AgentGuard } from './guards/agent.guard';
import { Public } from '../auth/decorators/public.decorator';

// DTOs
class LoginDto {
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email: string;

  @IsString()
  @MinLength(6, { message: '密码至少6位' })
  password: string;
}

class ChangePasswordDto {
  @IsString()
  @MinLength(6)
  oldPassword: string;

  @IsString()
  @MinLength(6, { message: '新密码至少6位' })
  newPassword: string;
}

class UpdateSettlementDto {
  @IsString()
  @IsOptional()
  walletAddress?: string;
}

@Controller('agent/auth')
@Public() // 跳过全局 JwtAuthGuard，使用 AgentGuard 进行认证
export class AgentAuthController {
  constructor(private agentAuthService: AgentAuthService) {}

  // 代理商登录（公开接口，无需认证）
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.agentAuthService.login(dto.email, dto.password);
  }

  // 获取当前代理商信息
  @Get('profile')
  @UseGuards(AgentGuard)
  async getProfile(@Request() req: any) {
    return this.agentAuthService.getProfile(req.agent.id);
  }

  // 修改密码
  @Put('password')
  @UseGuards(AgentGuard)
  async changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
    return this.agentAuthService.changePassword(
      req.agent.id,
      dto.oldPassword,
      dto.newPassword,
    );
  }

  // 更新结算账户
  @Put('settlement')
  @UseGuards(AgentGuard)
  async updateSettlement(
    @Request() req: any,
    @Body() dto: UpdateSettlementDto,
  ) {
    return this.agentAuthService.updateSettlementAccount(req.agent.id, dto);
  }
}
