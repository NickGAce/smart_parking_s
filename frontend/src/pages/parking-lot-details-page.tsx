import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Alert, Button, CircularProgress, Grid, Paper, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom';

import { useCurrentUser } from '../features/auth/use-current-user';
import { parkingApiErrorMessage } from '../features/parking-lots/error-messages';
import { useParkingLotQuery, useParkingLotRulesQuery, useReplaceParkingLotRulesMutation, useUpdateParkingLotMutation } from '../features/parking-lots/hooks';
import { ParkingLotForm } from '../features/parking-lots/parking-lot-form';
import { RulesEditor } from '../features/parking-lots/rules-editor';
import { PageHeader } from '../shared/ui/page-header';

export function ParkingLotDetailsPage() {
  const { lotId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useCurrentUser();

  const parkingLotId = Number(lotId);
  const canManage = role === 'admin' || role === 'owner';
  const isEditMode = searchParams.get('mode') === 'edit';

  const lotQuery = useParkingLotQuery(parkingLotId);
  const rulesQuery = useParkingLotRulesQuery(parkingLotId);
  const updateLotMutation = useUpdateParkingLotMutation(parkingLotId);
  const updateRulesMutation = useReplaceParkingLotRulesMutation(parkingLotId);

  const topError = useMemo(() => {
    if (lotQuery.isError) {
      return parkingApiErrorMessage(lotQuery.error, 'Не удалось загрузить парковку.');
    }
    if (rulesQuery.isError) {
      return parkingApiErrorMessage(rulesQuery.error, 'Не удалось загрузить правила.');
    }
    return null;
  }, [lotQuery.error, lotQuery.isError, rulesQuery.error, rulesQuery.isError]);

  if (!Number.isFinite(parkingLotId) || parkingLotId <= 0) {
    return <Alert severity="error">Некорректный parking_lot_id.</Alert>;
  }

  return (
    <Stack spacing={2}>
      <PageHeader
        title={`Parking lot #${parkingLotId}`}
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Parking lots', to: '/parking-lots' }, { label: `Lot #${parkingLotId}` }]}
      />

      <Stack direction="row" spacing={1}>
        <Button startIcon={<ArrowBackIcon />} component={RouterLink} to="/parking-lots">К списку</Button>
        <Button variant={isEditMode ? 'contained' : 'outlined'} disabled={!canManage} onClick={() => setSearchParams(isEditMode ? {} : { mode: 'edit' })}>
          {isEditMode ? 'Завершить редактирование' : 'Редактировать'}
        </Button>
      </Stack>

      {!canManage && <Alert severity="info">Роль с read-only доступом: можно просматривать детали и rules.</Alert>}
      {topError && <Alert severity="error">{topError}</Alert>}

      {(lotQuery.isLoading || rulesQuery.isLoading) && <CircularProgress />}

      {lotQuery.data && (
        <Grid container spacing={2}>
          <Grid item xs={12} lg={6}>
            <Paper sx={{ p: 2 }}>
              {isEditMode ? (
                <ParkingLotForm
                  initial={lotQuery.data}
                  title="Базовая информация"
                  submitLabel="Сохранить изменения"
                  disabled={updateLotMutation.isPending}
                  readOnly={!canManage}
                  serverError={updateLotMutation.isError ? parkingApiErrorMessage(updateLotMutation.error, 'Не удалось обновить парковку.') : null}
                  onSubmit={(payload) => updateLotMutation.mutate(payload)}
                />
              ) : (
                <Stack spacing={1}>
                  <Typography variant="h6">Базовая информация</Typography>
                  <Typography><b>Название:</b> {lotQuery.data.name}</Typography>
                  <Typography><b>Адрес:</b> {lotQuery.data.address}</Typography>
                  <Typography><b>Всего мест:</b> {lotQuery.data.total_spots}</Typography>
                  <Typography><b>Гостевые места:</b> {lotQuery.data.guest_spot_percentage}%</Typography>
                  <Typography><b>Access mode:</b> {lotQuery.data.access_mode}</Typography>
                  <Typography><b>Allowed roles:</b> {lotQuery.data.allowed_user_roles.length ? lotQuery.data.allowed_user_roles.join(', ') : 'не ограничено'}</Typography>
                </Stack>
              )}
            </Paper>
          </Grid>

          <Grid item xs={12} lg={6}>
            <Paper sx={{ p: 2 }}>
              {rulesQuery.data ? (
                <RulesEditor
                  initial={rulesQuery.data}
                  disabled={updateRulesMutation.isPending}
                  readOnly={!canManage}
                  serverError={updateRulesMutation.isError ? parkingApiErrorMessage(updateRulesMutation.error, 'Не удалось обновить rules.') : null}
                  onSubmit={(payload) => updateRulesMutation.mutate(payload)}
                />
              ) : (
                <Typography color="text.secondary">Правила пока недоступны.</Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}
    </Stack>
  );
}
