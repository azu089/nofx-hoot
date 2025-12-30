import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsBoolean,
  IsDateString,
  MaxLength,
} from 'class-validator';

/**
 * 创建公告 DTO
 */
export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty({ message: '标题不能为空' })
  @MaxLength(200, { message: '标题最多 200 字符' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: '内容不能为空' })
  content: string;

  @IsOptional()
  @IsString()
  @IsIn(['info', 'warning', 'success'], { message: '类型必须是 info/warning/success' })
  type?: string;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsDateString({}, { message: '开始时间格式不正确' })
  startAt?: string;

  @IsOptional()
  @IsDateString({}, { message: '结束时间格式不正确' })
  endAt?: string;
}

/**
 * 更新公告 DTO
 */
export class UpdateAnnouncementDto {
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: '标题最多 200 字符' })
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  @IsIn(['info', 'warning', 'success'], { message: '类型必须是 info/warning/success' })
  type?: string;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsDateString({}, { message: '开始时间格式不正确' })
  startAt?: string;

  @IsOptional()
  @IsDateString({}, { message: '结束时间格式不正确' })
  endAt?: string;
}
