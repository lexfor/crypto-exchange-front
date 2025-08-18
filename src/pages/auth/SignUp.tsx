import AuthForm from '../../components/AuthForm';
import { SignUpForm } from '../../types/auth/sign-up';
import { AuthActivityType } from '../../types/auth';
import { useNavigate } from 'react-router-dom';
import { handleResponse } from './handlers/sign-up.response-handler';

export default function SignUp() {
	const navigate = useNavigate();

	const handleSignUp = async ({ email, password, username, fullName }: SignUpForm) => {
		const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
		const res = await fetch(`${apiBaseUrl}/auth/sign-up`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, password, username, fullName }),
		});

		await handleResponse(res, navigate)
	};

	return (
		<main>
			<AuthForm type={AuthActivityType.SIGN_UP} onSubmit={handleSignUp} />
		</main>
	);
}
