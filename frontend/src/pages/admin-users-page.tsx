import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import {
  Alert,
  Box,
  Button,
  Grid,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';

import { useCreateUserMutation } from '../features/admin-users/use-create-user-mutation';
import { useUpdateUserRoleMutation } from '../features/admin-users/use-update-user-role-mutation';
import { adaptApiError } from '../shared/api/error-adapter';
import { userRoleLabels } from '../shared/config/display-labels';
import { ALL_USER_ROLES } from '../shared/config/roles';
import { ActionBar } from '../shared/ui/action-bar';
import { ConfirmDialog } from '../shared/ui/confirm-dialog';
import { EmptyState } from '../shared/ui/empty-state';
import { FiltersToolbar } from '../shared/ui/filters-toolbar';
import { FormActions } from '../shared/ui/form-actions';
import { FormPageTemplate } from '../shared/ui/page-templates';
import { FormSection } from '../shared/ui/form-section';
import { StateFeedback } from '../shared/ui/state-feedback';
import { StatusChip } from '../shared/ui/status-chip';
import type { StatusMeta } from '../shared/config/status-map';
import type { UserRole } from '../shared/types/common';

const roleOptions: UserRole[] = ALL_USER_ROLES;

type UserOperationStatus = 'draft' | 'active' | 'changed';

interface UserRegistryEntry {
  id: number;
  email: string;
  role: UserRole;
  status: UserOperationStatus;
}

const userOperationStatusMap: Record<UserOperationStatus, StatusMeta> = {
  draft: { label: 'Черновик', color: 'default' },
  active: { label: 'Актуально', color: 'success' },
  changed: { label: 'Обновлено', color: 'info' },
};

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

function normalizeId(value: string) {
  const normalized = Number(value);

  if (!Number.isInteger(normalized) || normalized <= 0) {
    return null;
  }

  return normalized;
}

function roleSearchText(role: UserRole) {
  return `${role} ${userRoleLabels[role]}`.toLowerCase();
}

export function AdminUsersPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [createRole, setCreateRole] = useState<UserRole>('tenant');

  const [userId, setUserId] = useState('');
  const [updateRole, setUpdateRole] = useState<UserRole>('tenant');
  const [confirmRoleDialogOpen, setConfirmRoleDialogOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [registry, setRegistry] = useState<UserRegistryEntry[]>([]);

  const createMutation = useCreateUserMutation();
  const updateRoleMutation = useUpdateUserRoleMutation();

  const createErrorDetails = useMemo(
    () => formatFieldErrors(adaptApiError(createMutation.error).fieldErrors),
    [createMutation.error],
  );

  const filteredRegistry = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return registry.filter((entry) => {
      const roleMatch = roleFilter ? entry.role === roleFilter : true;

      if (!roleMatch) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return (
        entry.email.toLowerCase().includes(normalizedSearch)
        || String(entry.id).includes(normalizedSearch)
        || roleSearchText(entry.role).includes(normalizedSearch)
      );
    });
  }, [registry, roleFilter, searchTerm]);

  const createFormReset = () => {
    setEmail('');
    setPassword('');
    setCreateRole('tenant');
  };

  const editFormReset = () => {
    setUserId('');
    setUpdateRole('tenant');
  };

  const syncCreatedUser = (createdUser: UserRegistryEntry) => {
    setRegistry((previous) => {
      const existing = previous.find((entry) => entry.id === createdUser.id);

      if (!existing) {
        return [{ ...createdUser, status: 'active' }, ...previous];
      }

      return previous.map((entry) => (
        entry.id === createdUser.id
          ? { ...entry, ...createdUser, status: 'active' }
          : entry
      ));
    });
  };

  const syncUpdatedUser = (updatedUser: UserRegistryEntry) => {
    setRegistry((previous) => {
      const exists = previous.some((entry) => entry.id === updatedUser.id);

      if (!exists) {
        return [{ ...updatedUser, status: 'changed' }, ...previous];
      }

      return previous.map((entry) => (
        entry.id === updatedUser.id
          ? { ...entry, role: updatedUser.role, email: updatedUser.email, status: 'changed' }
          : entry
      ));
    });
  };

  const onCreateSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    createMutation.mutate(
      { email, password, role: createRole },
      {
        onSuccess: (user) => {
          createFormReset();
          syncCreatedUser({
            id: user.id,
            email: user.email,
            role: user.role,
            status: 'active',
          });
        },
      },
    );
  };

  const submitRoleUpdate = () => {
    const normalizedId = normalizeId(userId);

    if (!normalizedId) {
      return;
    }

    updateRoleMutation.mutate(
      {
        userId: normalizedId,
        payload: { role: updateRole },
      },
      {
        onSuccess: (user) => {
          setConfirmRoleDialogOpen(false);
          syncUpdatedUser({
            id: user.id,
            email: user.email,
            role: user.role,
            status: 'changed',
          });
        },
      },
    );
  };

  const hasKnownUsers = registry.length > 0;

  return (
    <>
      <FormPageTemplate
        maxWidth="100%"
        meta="администрирование / пользователи"
        title="Пользователи и роли"
        subtitle="Операционный сценарий создания и изменения ролей с единым UX-паттерном для админской зоны."
        helperText={(
          <StateFeedback severity="info">
            API администрирования поддерживает только <code>POST /admin/users</code> и <code>PATCH /admin/users/{'{user_id}'}</code>. Список пользователей не приходит с сервера,
            поэтому таблица ниже показывает записи, созданные или обновленные в рамках текущей сессии оператора.
          </StateFeedback>
        )}
        formSections={(
        <Stack spacing={2.5}>
          <ActionBar
            actions={(
              <Button
                variant="outlined"
                startIcon={<TuneOutlinedIcon />}
                onClick={() => {
                  setSearchTerm('');
                  setRoleFilter('');
                }}
              >
                Сбросить фильтры журнала
              </Button>
            )}
          >
            <Stack spacing={0.25}>
              <Typography variant="tableLabel" color="text.secondary">создано в сессии</Typography>
              <Typography variant="h6">{registry.filter((entry) => entry.status === 'active').length}</Typography>
            </Stack>
            <Stack spacing={0.25}>
              <Typography variant="tableLabel" color="text.secondary">изменено в сессии</Typography>
              <Typography variant="h6">{registry.filter((entry) => entry.status === 'changed').length}</Typography>
            </Stack>
            <Stack spacing={0.25}>
              <Typography variant="tableLabel" color="text.secondary">всего записей</Typography>
              <Typography variant="h6">{registry.length}</Typography>
            </Stack>
          </ActionBar>

          <Grid container spacing={2}>
            <Grid item xs={12} lg={6}>
              <FormSection
                title="Создание пользователя"
                subtitle="Новая учетная запись с назначением стартовой роли"
                helperText="Заполните email и пароль. Роль можно изменить позже через блок редактирования."
                sx={{ p: { xs: 2.5, md: 3.25 }, height: '100%' }}
              >
                <Stack spacing={2} component="form" onSubmit={onCreateSubmit}>
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
                    <Alert severity="success">Пользователь создан и добавлен в сессионный журнал.</Alert>
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
                    label="Стартовая роль"
                    value={createRole}
                    onChange={(event) => setCreateRole(event.target.value as UserRole)}
                  >
                    {roleOptions.map((roleOption) => (
                      <MenuItem key={roleOption} value={roleOption}>
                        {userRoleLabels[roleOption]} ({roleOption})
                      </MenuItem>
                    ))}
                  </TextField>

                  <FormActions
                    secondary={<Button variant="text" onClick={createFormReset}>Очистить</Button>}
                    primary={(
                      <Button type="submit" variant="contained" startIcon={<PersonAddAlt1OutlinedIcon />} disabled={createMutation.isPending}>
                        Создать пользователя
                      </Button>
                    )}
                  />
                </Stack>
              </FormSection>
            </Grid>

            <Grid item xs={12} lg={6}>
              <FormSection
                title="Редактирование роли"
                subtitle="Изменение роли по идентификатору пользователя"
                helperText="Сначала укажите ID пользователя, затем выберите новую роль. Для подтверждения откроется диалог безопасности."
                sx={{ p: { xs: 2.5, md: 3.25 }, height: '100%' }}
              >
                <Stack
                  spacing={2}
                  component="form"
                  onSubmit={(event) => {
                    event.preventDefault();

                    if (!normalizeId(userId)) {
                      return;
                    }

                    setConfirmRoleDialogOpen(true);
                  }}
                >
                  {updateRoleMutation.isError && (
                    <Alert severity="error">
                      {mutationErrorMessage(updateRoleMutation.error, 'Не удалось обновить роль пользователя.')}
                    </Alert>
                  )}

                  {updateRoleMutation.isSuccess && (
                    <Alert severity="success">Роль пользователя обновлена и зафиксирована в журнале сессии.</Alert>
                  )}

                  <TextField
                    label="ID пользователя"
                    type="number"
                    value={userId}
                    onChange={(event) => setUserId(event.target.value)}
                    required
                    inputProps={{ min: 1 }}
                    helperText="Введите известный идентификатор. API не поддерживает поиск пользователей по списку."
                  />

                  <TextField
                    select
                    label="Новая роль"
                    value={updateRole}
                    onChange={(event) => setUpdateRole(event.target.value as UserRole)}
                  >
                    {roleOptions.map((roleOption) => (
                      <MenuItem key={roleOption} value={roleOption}>
                        {userRoleLabels[roleOption]} ({roleOption})
                      </MenuItem>
                    ))}
                  </TextField>

                  <FormActions
                    secondary={<Button variant="text" onClick={editFormReset}>Очистить</Button>}
                    primary={(
                      <Button
                        type="submit"
                        variant="contained"
                        startIcon={<ManageAccountsOutlinedIcon />}
                        disabled={updateRoleMutation.isPending || !normalizeId(userId)}
                      >
                        Продолжить
                      </Button>
                    )}
                  />
                </Stack>
              </FormSection>
            </Grid>
          </Grid>

          <FormSection
            title="Сессионный реестр пользователей"
            subtitle="Табличный обзор созданных и измененных записей"
            helperText="Реестр служит операционным буфером: помогает найти пользователя, проверить роль и быстро подставить ID в форму редактирования."
            sx={{ p: { xs: 2.5, md: 3.25 } }}
          >
            <FiltersToolbar
              onReset={() => {
                setSearchTerm('');
                setRoleFilter('');
              }}
              actions={<Typography variant="caption" color="text.secondary">Фильтры применяются сразу по мере ввода.</Typography>}
            >
              <TextField
                label="Поиск"
                size="small"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Email, ID, роль"
                inputProps={{ 'aria-label': 'Поиск по сессионному реестру пользователей' }}
                sx={{ width: { xs: '100%', md: 'auto' }, minWidth: { md: 260 } }}
              />
              <TextField
                select
                label="Роль"
                size="small"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as UserRole | '')}
                sx={{ width: { xs: '100%', md: 'auto' }, minWidth: { md: 220 } }}
              >
                <MenuItem value="">Все роли</MenuItem>
                {roleOptions.map((roleOption) => (
                  <MenuItem key={roleOption} value={roleOption}>{userRoleLabels[roleOption]}</MenuItem>
                ))}
              </TextField>
            </FiltersToolbar>

            {!hasKnownUsers ? (
              <EmptyState
                kind="no-results"
                title="Пока нет записей"
                description="Создайте пользователя или измените роль, чтобы в этой таблице появилась первая запись."
              />
            ) : filteredRegistry.length === 0 ? (
              <EmptyState
                kind="no-results"
                title="Совпадения не найдены"
                description="Измените параметры поиска или сбросьте фильтры."
              />
            ) : (
              <TableContainer sx={{ overflowX: 'auto', maxHeight: 520 }}>
                <Table stickyHeader size="small" aria-label="Сессионный реестр пользователей">
                  <TableHead>
                    <TableRow sx={{ '& .MuiTableCell-root': { bgcolor: 'action.hover', whiteSpace: 'nowrap' } }}>
                      <TableCell scope="col">ID</TableCell>
                      <TableCell scope="col">Email</TableCell>
                      <TableCell scope="col">Роль</TableCell>
                      <TableCell scope="col">Статус</TableCell>
                      <TableCell scope="col" align="right">Действия</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredRegistry.map((entry) => (
                      <TableRow key={entry.id} hover>
                        <TableCell component="th" scope="row">{entry.id}</TableCell>
                        <TableCell sx={{ overflowWrap: 'anywhere' }}>{entry.email}</TableCell>
                        <TableCell>{userRoleLabels[entry.role]}</TableCell>
                        <TableCell>
                          <StatusChip status={entry.status} mapping={userOperationStatusMap} variant="outlined" />
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ minWidth: 210, display: 'flex', justifyContent: 'flex-end' }}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => {
                                setUserId(String(entry.id));
                                setUpdateRole(entry.role);
                              }}
                              aria-label={`Подставить пользователя ${entry.email} с ID ${entry.id} в форму редактирования`}
                              sx={{ whiteSpace: 'normal', textAlign: 'right' }}
                            >
                              Подставить в редактирование
                            </Button>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </FormSection>
        </Stack>
      )}
      />

      <ConfirmDialog
        open={confirmRoleDialogOpen}
        title="Подтвердите изменение роли"
        subtitle="Проверьте идентификатор и целевую роль перед применением"
        description={(
          <Stack spacing={1}>
            <Typography>
              Вы меняете роль пользователя <b>#{userId}</b> на <b>{userRoleLabels[updateRole]}</b>.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Действие повлияет на доступ пользователя сразу после успешного ответа API.
            </Typography>
          </Stack>
        )}
        confirmLabel="Изменить роль"
        cancelLabel="Отмена"
        pending={updateRoleMutation.isPending}
        onCancel={() => setConfirmRoleDialogOpen(false)}
        onConfirm={submitRoleUpdate}
      />
    </>
  );
}
