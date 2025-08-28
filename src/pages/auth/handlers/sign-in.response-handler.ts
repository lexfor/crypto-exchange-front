import { toast } from 'react-toastify';
import type { SignInResponse } from '../../../types/auth/sign-in';

type NavigateFunction = (path: string) => void;

interface ResponseHandlers {
  [key: number]: (message?: string) => void;
}

const responseHandlers: ResponseHandlers = {
  200: (message?: string) =>
    toast.success(message || 'Successfully logged in!'),
  400: (message?: string) =>
    toast.error(message || 'Invalid credentials. Please check your input.'),
  401: (message?: string) =>
    toast.error(message || 'Invalid email or password.'),
  403: (message?: string) =>
    toast.error(message || 'Access forbidden. Please try again.'),
  500: (message?: string) =>
    toast.error(message || 'Server error. Please try again later.'),
};

export const handleResponse = async (
  response: Response,
  navigate?: NavigateFunction
): Promise<void> => {
  let errorData: Partial<SignInResponse> = {};

  try {
    if (!response.ok) {
      errorData = await response.json();
      const handler = responseHandlers[response.status];
      if (handler) {
        handler(errorData.message);
      } else {
        toast.error('An unexpected error occurred.');
      }
      return;
    }

    const data = await response.json();
    responseHandlers[response.status](data.message);

    if (navigate && response.ok) {
      navigate('/');
    }
  } catch (error) {
    console.error('Error handling response:', error);
    toast.error('An unexpected error occurred.');
  }
};
