import {
  Alert,
  Button,
  Divider,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';

import { useCreateUserMutation } from '../features/admin-users/use-create-user-mutation';
import { useUpdateUserRoleMutation } from '../features/admin-users/use-update-user-role-mutation';
import { adaptApiError } from '../shared/api/error-adapter';
import { ALL_USER_ROLES } from '../shared/config/roles';
import type { UserRole } from '../shared/types/common';

const roleOptions: UserRole[] = ALL_USER_ROLES;

function formatFieldErrors(fieldErrors?: Array<{ loc: Array<string | number>; msg: string }>) {
  if (!fieldErrors || fieldErrors.length === 0) {
    return [];
  }

  return fieldErrors.map((error) => {
    const fieldPath = error.loc.slice(1).join('.');
    return `${fieldPath || 'поле'}: ${error.msg}`;
  });
}

function mutationErrorMessage(error: unknown, fallback: string) {
  const apiError = adaptApiError(error);

  if (apiError.status === 409) {
    return 'Пользователь с таким email уже существует.';
  }

  return apiError.detail || apiError.message || fallback;
}

export function AdminUsersPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [createRole, setCreateRole] = useState<UserRole>('tenant');

  const [userId, setUserId] = useState('');
  const [updateRole, setUpdateRole] = useState<UserRole>('tenant');

  const createMutation = useCreateUserMutation();
  const updateRoleMutation = useUpdateUserRoleMutation();

  const createErrorDetails = useMemo(
    () => formatFieldErrors(adaptApiError(createMutation.error).fieldErrors),
    [createMutation.error],
  );

  return (
    <Stack spacing={2}>

      <Alert severity="info">
        Сервер поддерживает только <code>POST /admin/users</code> и <code>PATCH /admin/users/{'{user_id}'}</code>.
        Endpoint списка пользователей отсутствует, поэтому изменение роли выполняется по известному ID пользователя.
      </Alert>

      <Grid container spacing={2}>
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Stack
              spacing={2}
              component="form"
              onSubmit={(event) => {
                event.preventDefault();
                createMutation.mutate(
                  { email, password, role: createRole },
                  {
                    onSuccess: () => {
                      setEmail('');
                      setPassword('');
                    },
                  },
                );
              }}
            >
              <Typography variant="h6">Создание пользователя</Typography>

              {createMutation.isError && (
                <Alert severity="error">
                  {mutationErrorMessage(createMutation.error, 'Не удалось создать пользователя.')}
                  {createErrorDetails.length > 0 && (
                    <Stack sx={{ mt: 1 }}>
                      {createErrorDetails.map((detail) => (
                        <Typography key={detail} variant="body2">• {detail}</Typography>
                      ))}
                    </Stack>
                  )}
                </Alert>
              )}

              {createMutation.isSuccess && (
                <Alert severity="success">Пользователь успешно создан.</Alert>
              )}

              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />

              <TextField
                label="Пароль"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />

              <TextField
                select
                label="Роль"
                value={createRole}
                onChange={(event) => setCreateRole(event.target.value as UserRole)}
              >
                {roleOptions.map((roleOption) => (
                  <MenuItem key={roleOption} value={roleOption}>
                    {roleOption}
                  </MenuItem>
                ))}
              </TextField>

              <Button type="submit" variant="contained" disabled={createMutation.isPending}>
                Создать пользователя
              </Button>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Stack
              spacing={2}
              component="form"
              onSubmit={(event) => {
                event.preventDefault();

                const normalizedId = Number(userId);
                if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
                  return;
                }

                updateRoleMutation.mutate({
                  userId: normalizedId,
                  payload: { role: updateRole },
                });
              }}
            >
              <Typography variant="h6">Изменение роли пользователя</Typography>
              <Typography variant="body2" color="text.secondary">
                По API это сценарий <code>PATCH /admin/users/{'{user_id}'}</code>. ID вводится вручную,
                потому что backend не предоставляет <code>GET /admin/users</code>.
              </Typography>

              <Divider />

              {updateRoleMutation.isError && (
                <Alert severity="error">
                  {mutationErrorMessage(updateRoleMutation.error, 'Не удалось обновить роль пользователя.')}
                </Alert>
              )}

              {updateRoleMutation.isSuccess && (
                <Alert severity="success">Роль пользователя обновлена.</Alert>
              )}

              <TextField
                label="ID пользователя"
                type="number"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                required
                inputProps={{ min: 1 }}
                helperText="Введите существующий идентификатор пользователя"
              />

              <TextField
                select
                label="Новая роль"
                value={updateRole}
                onChange={(event) => setUpdateRole(event.target.value as UserRole)}
              >
                {roleOptions.map((roleOption) => (
                  <MenuItem key={roleOption} value={roleOption}>
                    {roleOption}
                  </MenuItem>
                ))}
              </TextField>

              <Button
                type="submit"
                variant="contained"
                disabled={updateRoleMutation.isPending || !userId || Number(userId) <= 0}
              >
                Обновить роль
              </Button>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  );
}
