import { toast } from 'react-toastify';
import { SignUpResponse } from '../../../types/auth/sign-up';

type NavigateFunction = (path: string) => void;

interface ResponseHandlers {
  [key: number]: (message?: string) => void;
}

const responseHandlers: ResponseHandlers = {
  201: (message?: string) =>
    toast.success(
      message || 'User successfully created! Redirecting to login...'
    ),
  400: (message?: string) =>
    toast.error(message || 'Invalid data. Please check your input.'),
  403: (message?: string) =>
    toast.error(message || 'Access forbidden. Please try again.'),
  409: (message?: string) => toast.error(message || 'User already exists.'),
  500: (message?: string) =>
    toast.error(message || 'Server error. Please try again later.'),
};

export const handleResponse = async (
  response: Response,
  navigate?: NavigateFunction
): Promise<void> => {
  let errorData: Partial<SignUpResponse> = {};

  try {
    if (!response.ok) {
      errorData = await response.json();
    }
  } catch (e) {
    console.error('Error parsing response:', e);
  }

  const handler = responseHandlers[response.status];

  if (handler) {
    handler(errorData.message);
  } else {
    toast.error(errorData.message || `Unexpected error: ${response.status}`);
  }

  if (response.ok && navigate) {
    setTimeout(() => {
      toast.success('Redirecting to login page...');
      navigate('/sign-in');
    }, 1500);
  }
};
