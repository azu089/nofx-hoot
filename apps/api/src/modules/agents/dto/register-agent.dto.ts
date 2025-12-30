import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';

/**
 * 代理商注册 DTO
 */
export class RegisterAgentDto {
  @IsString()
  @IsNotEmpty({ message: '代理商名称不能为空' })
  @MinLength(2, { message: '代理商名称至少2个字符' })
  @MaxLength(100, { message: '代理商名称最多100个字符' })
  name: string;

  @IsEmail({}, { message: '邮箱格式不正确' })
  @IsNotEmpty({ message: '邮箱不能为空' })
  email: string;
}
