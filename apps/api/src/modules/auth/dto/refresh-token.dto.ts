import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 刷新 Token 请求 DTO
 */
export class RefreshTokenDto {
  @ApiProperty({
    description: '刷新令牌',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty({ message: '刷新令牌不能为空' })
  refreshToken: string;
}

/**
 * 刷新 Token 响应 DTO
 */
export class RefreshTokenResponseDto {
  @ApiProperty({ description: '新的访问令牌' })
  accessToken: string;

  @ApiProperty({ description: '新的刷新令牌' })
  refreshToken: string;

  @ApiProperty({ description: '访问令牌过期时间（秒）' })
  expiresIn: number;
}
