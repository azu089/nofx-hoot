import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';

/**
 * 绑定用户到代理商 DTO
 */
export class BindUserDto {
  @IsString()
  @IsNotEmpty({ message: '邀请码不能为空' })
  @Length(6, 6, { message: '邀请码长度为6位' })
  @Matches(/^[A-Z0-9]{6}$/, { message: '邀请码格式不正确（6位大写字母+数字）' })
  inviteCode: string;
}
