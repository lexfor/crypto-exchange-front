import AuthForm from '../../components/AuthForm';
import { SignUpForm } from '../../types/auth/sign-up';
import { AuthActivityType } from '../../types/auth';
import { useNavigate } from 'react-router-dom';
import { handleResponse } from './handlers/sign-up.response-handler';
import { useEffect, useState } from 'react';

export default function SignUp() {
	const navigate = useNavigate();
	const [data, setData] = useState(new Response());
	const [error, setError] = useState('');

	const handleSignUp = async ({ email, password, username, fullName }: SignUpForm) => {
		const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;

		try {
			const res = await fetch(`${apiBaseUrl}/auth/sign-up`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password, username, fullName }),
			});
			if (!res.ok) {
				throw new Error(`HTTP error! Status: ${res.status}`);
			}
			const data = await res.json();
			setData(data);
			await handleResponse(data, navigate);
		} catch (err: any) {
			setError(err.message);
		}
	};

	return (
		<main>
			<AuthForm type={AuthActivityType.SIGN_UP} onSubmit={handleSignUp} />
		</main>
	);
}
