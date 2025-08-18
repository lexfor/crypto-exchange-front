import { toast } from 'react-toastify';
import { ResponsePopUps } from '../../../types';

const responsePopUps: ResponsePopUps = {
    201: () => toast.success('User successfully created!'),
    400: () => toast.error('Bad request. Please check your data.'),
    403: () => toast.error('Forbidden.'),
    500: () => toast.error('Server error. Try again later.')
};

export const handleResponse = async (res: Response, navigate?: (path: string) => void) => {
    const popUp = responsePopUps[res.status];
    if (popUp) popUp();
    else toast.error(`Unexpected error: ${res.status}`);

    if (res.ok && navigate) {
        setTimeout(() => navigate('/sign-in'), 1000);
    }
};
