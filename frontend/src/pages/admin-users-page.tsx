import { Alert, Button, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';

import { useCreateUserMutation } from '../features/admin-users/use-create-user-mutation';
import type { UserRole } from '../shared/types/common';

export function AdminUsersPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('tenant');
  const mutation = useCreateUserMutation();

  return (
    <Paper sx={{ p: 3, maxWidth: 520 }}>
      <Stack spacing={2} component="form" onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate({ email, password, role });
      }}>
        <Typography variant="h6">Create user</Typography>
        {mutation.isError && <Alert severity="error">Операция доступна только admin.</Alert>}
        {mutation.isSuccess && <Alert severity="success">Пользователь создан.</Alert>}
        <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <TextField select label="Role" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
          {['admin', 'owner', 'tenant', 'guard', 'uk'].map((roleOption) => (
            <MenuItem key={roleOption} value={roleOption}>{roleOption}</MenuItem>
          ))}
        </TextField>
        <Button type="submit" variant="contained" disabled={mutation.isPending}>Create</Button>
      </Stack>
    </Paper>
  );
}
