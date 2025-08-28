import { AuthActivityType } from '../../types/auth';
import { validatePassword } from '../../utils/validatePassword';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AuthFormDto {
  email!: string;
  password!: string;
  username?: string;
  fullName?: string;
  confirmPassword?: string;
  type!: AuthActivityType;
  setValidationErrors!: (errors: Record<string, string | string[]>) => void;

  constructor(data: Partial<AuthFormDto> = {}) {
    Object.assign(this, data);
  }

  static create(data: Partial<AuthFormDto>): AuthFormDto {
    return new AuthFormDto(data);
  }

  validate(): boolean {
    const errors: Record<string, string | string[]> = {};

    if (!EMAIL_REGEX.test(this.email)) {
      errors.email = 'Please enter a valid email address';
    }

    const passwordErrors = validatePassword(this.password);
    if (passwordErrors.length > 0) {
      errors.password = passwordErrors;
    }

    if (this.type === AuthActivityType.SIGN_UP) {
      if (this.password !== this.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }
      if (!this.username || this.username.length < 3) {
        errors.username = 'Username must be at least 3 characters long';
      }
      if (!this.fullName || this.fullName.length < 2) {
        errors.fullName = 'Please enter your full name';
      }
    }

    this.setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  toSubmitData() {
    const baseData = {
      email: this.email,
      password: this.password,
    };

    if (this.type === AuthActivityType.SIGN_UP) {
      return {
        ...baseData,
        username: this.username,
        fullName: this.fullName,
      };
    }

    return baseData;
  }
}
