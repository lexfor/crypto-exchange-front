export interface SignUpForm {
  email: string;
  password: string;
  username: string;
  fullName: string;
}

export interface SignUpResponse {
  message: string;
  status: number;
}
