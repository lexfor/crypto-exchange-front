import AuthForm from '../../components/AuthForm';
import { AuthActivityType } from '../../types/auth';
import { SignInForm } from '../../types/auth/sign-in';

export default function SignIn() {
	const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;

	const handleSignIn = async ({ email, password }: SignInForm) => {
		const res = await fetch(`${apiBaseUrl}/auth/sign-in`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, password }),
		});

		const data = await res.json();
		console.log(data);
	};

	return (
		<main>
			<AuthForm type={AuthActivityType.SIGN_IN} onSubmit={handleSignIn} />
		</main>
	);
}
