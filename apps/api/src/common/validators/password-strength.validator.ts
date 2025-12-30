import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

/**
 * 密码强度要求
 */
export interface PasswordStrengthOptions {
  minLength?: number;
  maxLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumber?: boolean;
  requireSpecialChar?: boolean;
}

const DEFAULT_OPTIONS: PasswordStrengthOptions = {
  minLength: 8,
  maxLength: 32,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: false, // 可选，避免用户体验过于复杂
};

/**
 * 密码强度校验器
 */
@ValidatorConstraint({ async: false })
export class PasswordStrengthConstraint implements ValidatorConstraintInterface {
  private failedReason: string = '';

  validate(password: string, args: ValidationArguments): boolean {
    const options: PasswordStrengthOptions = {
      ...DEFAULT_OPTIONS,
      ...(args.constraints[0] || {}),
    };

    if (typeof password !== 'string') {
      this.failedReason = '密码必须是字符串';
      return false;
    }

    // 长度检查
    if (options.minLength && password.length < options.minLength) {
      this.failedReason = `密码至少需要 ${options.minLength} 个字符`;
      return false;
    }

    if (options.maxLength && password.length > options.maxLength) {
      this.failedReason = `密码最多 ${options.maxLength} 个字符`;
      return false;
    }

    // 大写字母检查
    if (options.requireUppercase && !/[A-Z]/.test(password)) {
      this.failedReason = '密码必须包含至少一个大写字母';
      return false;
    }

    // 小写字母检查
    if (options.requireLowercase && !/[a-z]/.test(password)) {
      this.failedReason = '密码必须包含至少一个小写字母';
      return false;
    }

    // 数字检查
    if (options.requireNumber && !/[0-9]/.test(password)) {
      this.failedReason = '密码必须包含至少一个数字';
      return false;
    }

    // 特殊字符检查
    if (options.requireSpecialChar && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      this.failedReason = '密码必须包含至少一个特殊字符';
      return false;
    }

    // 常见弱密码检查
    const commonWeakPasswords = [
      'password',
      '12345678',
      '123456789',
      'qwerty123',
      'admin123',
      'letmein1',
      'welcome1',
      'password1',
      'Password1',
    ];

    if (commonWeakPasswords.includes(password.toLowerCase())) {
      this.failedReason = '密码过于简单，请使用更复杂的密码';
      return false;
    }

    // 连续字符检查（如 123456、abcdef）
    if (this.hasSequentialChars(password, 4)) {
      this.failedReason = '密码不能包含连续的字符序列';
      return false;
    }

    // 重复字符检查（如 aaaa、1111）
    if (this.hasRepeatedChars(password, 4)) {
      this.failedReason = '密码不能包含过多重复字符';
      return false;
    }

    return true;
  }

  defaultMessage(): string {
    return this.failedReason || '密码强度不足';
  }

  /**
   * 检查是否有连续字符
   */
  private hasSequentialChars(str: string, length: number): boolean {
    for (let i = 0; i <= str.length - length; i++) {
      let isSequential = true;
      for (let j = 1; j < length; j++) {
        if (str.charCodeAt(i + j) !== str.charCodeAt(i + j - 1) + 1) {
          isSequential = false;
          break;
        }
      }
      if (isSequential) return true;
    }
    return false;
  }

  /**
   * 检查是否有重复字符
   */
  private hasRepeatedChars(str: string, length: number): boolean {
    for (let i = 0; i <= str.length - length; i++) {
      const char = str[i];
      let isRepeated = true;
      for (let j = 1; j < length; j++) {
        if (str[i + j] !== char) {
          isRepeated = false;
          break;
        }
      }
      if (isRepeated) return true;
    }
    return false;
  }
}

/**
 * 密码强度校验装饰器
 *
 * @example
 * ```typescript
 * @IsStrongPassword()
 * password: string;
 *
 * @IsStrongPassword({ requireSpecialChar: true })
 * password: string;
 * ```
 */
export function IsStrongPassword(
  options?: PasswordStrengthOptions,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [options],
      validator: PasswordStrengthConstraint,
    });
  };
}

/**
 * 计算密码强度分数 (0-100)
 * 可用于前端展示密码强度
 */
export function calculatePasswordStrength(password: string): {
  score: number;
  level: 'weak' | 'fair' | 'good' | 'strong';
  suggestions: string[];
} {
  let score = 0;
  const suggestions: string[] = [];

  if (!password) {
    return { score: 0, level: 'weak', suggestions: ['请输入密码'] };
  }

  // 长度得分（最高 25 分）
  if (password.length >= 8) score += 10;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 5;
  if (password.length < 8) suggestions.push('建议密码至少 8 位');

  // 大写字母（15 分）
  if (/[A-Z]/.test(password)) {
    score += 15;
  } else {
    suggestions.push('添加大写字母可提高安全性');
  }

  // 小写字母（15 分）
  if (/[a-z]/.test(password)) {
    score += 15;
  } else {
    suggestions.push('添加小写字母可提高安全性');
  }

  // 数字（20 分）
  if (/[0-9]/.test(password)) {
    score += 20;
  } else {
    suggestions.push('添加数字可提高安全性');
  }

  // 特殊字符（25 分）
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    score += 25;
  } else {
    suggestions.push('添加特殊字符可显著提高安全性');
  }

  // 确定等级
  let level: 'weak' | 'fair' | 'good' | 'strong';
  if (score < 40) {
    level = 'weak';
  } else if (score < 60) {
    level = 'fair';
  } else if (score < 80) {
    level = 'good';
  } else {
    level = 'strong';
  }

  return { score, level, suggestions };
}
