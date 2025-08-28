import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthForm from '../../components/AuthForm/AuthForm';
import { AuthActivityType } from '../../types/auth';
import { handleResponse } from './handlers/sign-up.response-handler';
import { SignUpForm } from '../../types/auth/sign-up';
import { SignInForm } from '../../types/auth/sign-in';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export default function SignUp() {
  const navigate = useNavigate();
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignUp = async (formData: SignInForm | SignUpForm) => {
    setIsLoading(true);
    setError('');

    try {
      const signUpData = formData as SignUpForm;
      const res = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(signUpData),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Registration failed');
      }

      await handleResponse(res, navigate);
    } catch (err: any) {
      console.error('SignUp error:', err);
      setError(err.message || 'An unexpected error occurred');
      setIsLoading(false);
    }
  };

  return (
    <main>
      <AuthForm
        type={AuthActivityType.SIGN_UP}
        onSubmit={handleSignUp}
        isLoading={isLoading}
        error={error}
      />
    </main>
  );
}
