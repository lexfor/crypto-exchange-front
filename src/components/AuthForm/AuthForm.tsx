import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Stack,
  CircularProgress,
  Alert,
} from '@mui/material';
import { AuthActivityType, AuthFormProps } from '../../types/auth';
import { AuthFormDto } from './AuthFormDto';

export default function AuthForm({
  type,
  onSubmit,
  isLoading,
  error,
}: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string | string[]>
  >({});

  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const formDto = AuthFormDto.create({
      email,
      password,
      confirmPassword,
      username,
      fullName,
      type,
      setValidationErrors,
    });

    if (!formDto.validate()) return;

    onSubmit(formDto.toSubmitData());
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

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stack spacing={2}>
        <TextField
          inputRef={emailInputRef}
          label="Email"
          variant="outlined"
          type="email"
          fullWidth
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          error={!!validationErrors.email}
          helperText={validationErrors.email}
        />

        <TextField
          label="Password"
          variant="outlined"
          type="password"
          fullWidth
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          error={!!validationErrors.password}
          helperText={
            Array.isArray(validationErrors.password)
              ? validationErrors.password.join('. ')
              : validationErrors.password
          }
        />

        {type === AuthActivityType.SIGN_UP && (
          <>
            <TextField
              label="Confirm Password"
              variant="outlined"
              type="password"
              fullWidth
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              error={!!validationErrors.confirmPassword}
              helperText={validationErrors.confirmPassword}
            />

            <TextField
              label="Username"
              variant="outlined"
              type="text"
              fullWidth
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              error={!!validationErrors.username}
              helperText={validationErrors.username}
            />

            <TextField
              label="Full Name"
              variant="outlined"
              type="text"
              fullWidth
              required
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              error={!!validationErrors.fullName}
              helperText={validationErrors.fullName}
            />
          </>
        )}

        <Button
          variant="contained"
          color="primary"
          type="submit"
          fullWidth
          disabled={isLoading}
          sx={{ height: 42 }}
        >
          {isLoading ? (
            <CircularProgress size={24} color="inherit" />
          ) : type === AuthActivityType.SIGN_IN ? (
            'Sign In'
          ) : (
            'Sign Up'
          )}
        </Button>
      </Stack>
    </Box>
  );
}
