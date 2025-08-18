import { SignInForm } from '../sign-in';

export type SignUpForm = SignInForm & {
    username: string;
    fullName: string
}