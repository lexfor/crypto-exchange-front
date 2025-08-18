import { BrowserRouter as Router, Routes, Route, JSX } from 'react-router-dom';
import SignIn from './pages/auth/SignIn';
import SignUp from './pages/auth/SignUp';
import { ToastContainer } from 'react-toastify';

function App(): JSX.Element {
	return (
		<Router>
			<ToastContainer />
			<Routes>
				<Route path="/sign-in" element={<SignIn />} />
				<Route path="/sign-up" element={<SignUp />} />
			</Routes>
		</Router>
	);
}

export default App;
