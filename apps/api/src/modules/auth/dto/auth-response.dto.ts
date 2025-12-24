/**
 * 用户信息响应 DTO（不含敏感信息）
 */
export class UserResponseDto {
  id: string;
  email: string;
  vipLevel: number;
  agentId: string | null;
  inviteCode: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 认证响应 DTO
 */
export class AuthResponseDto {
  accessToken: string;
  user: UserResponseDto;
}
