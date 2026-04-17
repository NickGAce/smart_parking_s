import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Alert, Button, CircularProgress, Grid, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom';

import { useCurrentUser } from '../features/auth/use-current-user';
import { parkingApiErrorMessage } from '../features/parking-lots/error-messages';
import { ParkingLotForm } from '../features/parking-lots/parking-lot-form';
import { RulesEditor } from '../features/parking-lots/rules-editor';
import { useParkingLotQuery, useParkingLotRulesQuery, useReplaceParkingLotRulesMutation, useUpdateParkingLotMutation } from '../features/parking-lots/hooks';
import { MANAGEMENT_ROLES, hasRole } from '../shared/config/roles';
import { accessModeLabels } from '../shared/config/display-labels';
import { EntityHeader } from '../shared/ui/entity-header';
import { FormSection } from '../shared/ui/form-section';
import { KeyValueList } from '../shared/ui/key-value-list';
import { PageContentLayout } from '../shared/ui/page-content-layout';

export function ParkingLotDetailsPage() {
  const { lotId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useCurrentUser();

  const parkingLotId = Number(lotId);
  const canManage = hasRole(role, MANAGEMENT_ROLES);
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
    return <Alert severity="error">Некорректный идентификатор парковки.</Alert>;
  }

  return (
    <PageContentLayout>
      <EntityHeader
        title={lotQuery.data?.name ? `Парковка «${lotQuery.data.name}»` : `Парковка #${parkingLotId}`}
        subtitle="Управление базовой информацией и правилами доступа парковки."
        actions={(
          <>
            <Button startIcon={<ArrowBackIcon />} component={RouterLink} to="/parking-lots">Подробнее</Button>
            <Button variant={isEditMode ? 'contained' : 'outlined'} disabled={!canManage} onClick={() => setSearchParams(isEditMode ? {} : { mode: 'edit' })}>
              {isEditMode ? 'Сохранить' : 'Редактировать'}
            </Button>
          </>
        )}
      />

      {!canManage && <Alert severity="info">Режим только чтение: детали и правила доступны для просмотра.</Alert>}
      {topError && <Alert severity="error">{topError}</Alert>}

      {(lotQuery.isLoading || rulesQuery.isLoading) && <CircularProgress />}

      {lotQuery.data && (
        <Grid container spacing={2}>
          <Grid item xs={12} lg={6}>
            <FormSection title="Базовая информация">
              {isEditMode ? (
                <ParkingLotForm
                  initial={lotQuery.data}
                  title="Параметры парковки"
                  submitLabel="Сохранить"
                  disabled={updateLotMutation.isPending}
                  readOnly={!canManage}
                  serverError={updateLotMutation.isError ? parkingApiErrorMessage(updateLotMutation.error, 'Не удалось обновить парковку.') : null}
                  onSubmit={(payload) => updateLotMutation.mutate(payload)}
                />
              ) : (
                <Stack spacing={1}>
                  <KeyValueList
                    items={[
                      { key: 'Название', value: lotQuery.data.name },
                      { key: 'Адрес', value: lotQuery.data.address },
                      { key: 'Всего мест', value: lotQuery.data.total_spots },
                      { key: 'Гостевые места', value: `${lotQuery.data.guest_spot_percentage}%` },
                      { key: 'Режим доступа', value: accessModeLabels[lotQuery.data.access_mode] },
                      {
                        key: 'Разрешённые роли',
                        value: lotQuery.data.allowed_user_roles.length ? lotQuery.data.allowed_user_roles.join(', ') : 'Не ограничено',
                      },
                    ]}
                  />
                </Stack>
              )}
            </FormSection>
          </Grid>

          <Grid item xs={12} lg={6}>
            <FormSection title="Правила">
              {rulesQuery.data ? (
                <RulesEditor
                  initial={rulesQuery.data}
                  disabled={updateRulesMutation.isPending}
                  readOnly={!canManage}
                  serverError={updateRulesMutation.isError ? parkingApiErrorMessage(updateRulesMutation.error, 'Не удалось обновить правила.') : null}
                  onSubmit={(payload) => updateRulesMutation.mutate(payload)}
                />
              ) : (
                <Typography color="text.secondary">Правила пока недоступны.</Typography>
              )}
            </FormSection>
          </Grid>
        </Grid>
      )}
    </PageContentLayout>
  );
}
