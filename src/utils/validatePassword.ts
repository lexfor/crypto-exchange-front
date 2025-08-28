const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REGEX = {
  upperCase: /[A-Z]/,
  lowerCase: /[a-z]/,
  number: /[0-9]/,
  special: /[!@#$%^&*(),.?":{}|<>]/,
};

export const validatePassword = (password: string): string[] => {
  const errors: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`
    );
  }
  if (!PASSWORD_REGEX.upperCase.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!PASSWORD_REGEX.lowerCase.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!PASSWORD_REGEX.number.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!PASSWORD_REGEX.special.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return errors;
};
