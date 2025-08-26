import { type Id } from 'react-toastify';

export type ResponsePopUps = { [statusCode: number]: () => Id };
