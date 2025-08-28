export type SignInForm = {
  email: string;
  password: string;
};

export type SignInResponse = {
  message: string;
  token?: string;
};
