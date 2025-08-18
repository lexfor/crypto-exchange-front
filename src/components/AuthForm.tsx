import { useState } from 'react';
import {
	Box,
	Button,
	TextField,
	Typography,
	Stack,
} from '@mui/material';
import { AuthActivityType, AuthFormProps } from '../types/auth';

export default function AuthForm({ type, onSubmit }: AuthFormProps) {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [username, setUsername] = useState('');
	const [fullName, setFullName] = useState('');

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		onSubmit({ email, password, username, fullName });
	};

	return (
		<Box
			component="form"
			onSubmit={handleSubmit}
			sx={{
				width: '100%',
				maxWidth: 400,
				mx: 'auto',
				mt: 8,
				p: 4,
				borderRadius: 2,
				boxShadow: 3,
				bgcolor: 'background.paper',
			}}
		>
			<Typography variant="h5" fontWeight={600} mb={2}>
				{type === AuthActivityType.SIGN_IN ? 'Sign In' : 'Sign Up'}
			</Typography>

			<Stack spacing={2}>
				<TextField
					label="Email"
					variant="outlined"
					type="email"
					fullWidth
					required
					value={email}
					onChange={(e) => setEmail(e.target.value)}
				/>

				<TextField
					label="Password"
					variant="outlined"
					type="password"
					fullWidth
					required
					value={password}
					onChange={(e) => setPassword(e.target.value)}
				/>

				{type !== AuthActivityType.SIGN_IN && <TextField
					label="username"
					variant="outlined"
					type="text"
					fullWidth
					required
					value={username}
					onChange={(e) => setUsername(e.target.value)}
				/>}

				{type !== AuthActivityType.SIGN_IN &&<TextField
					label="full Name"
					variant="outlined"
					type="text"
					fullWidth
					required
					value={fullName}
					onChange={(e) => setFullName(e.target.value)}
				/>}

				<Button variant="contained" color="primary" type="submit" fullWidth>
					{type === AuthActivityType.SIGN_IN ? 'Sign In' : 'Sign Up'}
				</Button>
			</Stack>
		</Box>
	);
}
