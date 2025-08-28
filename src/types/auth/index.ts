import { SignUpForm } from './sign-up';
import { SignInForm } from './sign-in';

export enum AuthActivityType {
  SIGN_IN = 'signin',
  SIGN_UP = 'signup',
}

export type AuthFormProps = {
  type: AuthActivityType;
  onSubmit: (data: SignInForm | SignUpForm) => void;
  isLoading?: boolean;
  error?: string;
};
