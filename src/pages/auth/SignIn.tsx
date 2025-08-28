import AuthForm from '../../components/AuthForm/AuthForm';
import { AuthActivityType } from '../../types/auth';
import { SignInForm } from '../../types/auth/sign-in';
import { useNavigate } from 'react-router-dom';
import { handleResponse } from './handlers/sign-in.response-handler';

export default function SignIn() {
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
  const navigate = useNavigate();

  const handleSignIn = async ({ email, password }: SignInForm) => {
    const res = await fetch(`${apiBaseUrl}/auth/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    await handleResponse(res, navigate);
  };

  return (
    <main>
      <AuthForm type={AuthActivityType.SIGN_IN} onSubmit={handleSignIn} />
    </main>
  );
}
