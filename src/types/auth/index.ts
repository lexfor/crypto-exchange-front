import { SignUpForm } from './sign-up';

export enum AuthActivityType {
    SIGN_IN = 'signin',
    SIGN_UP = 'signup'
}

export type AuthFormProps = {
    type: AuthActivityType;
    onSubmit: (data: SignUpForm) => void;
};