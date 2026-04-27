import { Alert, Box, Button, Chip, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useMemo, useState } from 'react';

import { useParkingLotsQuery } from '../features/parking-lots/use-parking-lots-query';
import {
  useAccessEventsQuery,
  useManualAccessEventMutation,
  useLatestAccessEventsQuery,
} from '../features/access-events/hooks';
import type { AccessDecision, AccessDirection, AccessEventsQuery } from '../shared/types/access-event';
import { DataListPageTemplate } from '../shared/ui/page-templates';
import { DataPanel } from '../shared/ui/data-panel';

const decisionColor: Record<AccessDecision, 'success' | 'warning' | 'error'> = {
  allowed: 'success',
  review: 'warning',
  denied: 'error',
};

export function AccessControlPage() {
  const parkingLotsQuery = useParkingLotsQuery({ limit: 100, offset: 0 });
  const latestEventsQuery = useLatestAccessEventsQuery(5);

  const [parkingLotId, setParkingLotId] = useState<number | ''>('');
  const [plateNumber, setPlateNumber] = useState('');
  const [direction, setDirection] = useState<AccessDirection>('entry');
  const [decision, setDecision] = useState<AccessDecision | ''>('');
  const [filterPlate, setFilterPlate] = useState('');

  const filters: AccessEventsQuery = useMemo(
    () => ({
      parking_lot_id: parkingLotId === '' ? undefined : parkingLotId,
      decision: decision || undefined,
      direction,
      plate_number: filterPlate || undefined,
      limit: 20,
      offset: 0,
    }),
    [decision, direction, filterPlate, parkingLotId],
  );

  const eventsQuery = useAccessEventsQuery(filters);
  const manualMutation = useManualAccessEventMutation();

  const submitManual = async () => {
    if (parkingLotId === '' || !plateNumber.trim()) {
      return;
    }
    await manualMutation.mutateAsync({
      parking_lot_id: parkingLotId,
      plate_number: plateNumber,
      direction,
    });
    setPlateNumber('');
  };

  return (
    <DataListPageTemplate
      title="Контроль доступа"
      subtitle="Распознавание номеров, автоматический check-in/check-out и журнал событий въезда/выезда."
      filters={(
        <Stack spacing={1.5}>
          <Grid container spacing={1.5}>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                select
                label="Парковка"
                value={parkingLotId}
                onChange={(event) => setParkingLotId(event.target.value ? Number(event.target.value) : '')}
              >
                <MenuItem value="">Все парковки</MenuItem>
                {(parkingLotsQuery.data?.items ?? []).map((lot) => (
                  <MenuItem key={lot.id} value={lot.id}>{lot.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField fullWidth select label="Направление" value={direction} onChange={(e) => setDirection(e.target.value as AccessDirection)}>
                <MenuItem value="entry">Въезд</MenuItem>
                <MenuItem value="exit">Выезд</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField fullWidth select label="Решение" value={decision} onChange={(e) => setDecision(e.target.value as AccessDecision | '')}>
                <MenuItem value="">Все</MenuItem>
                <MenuItem value="allowed">allowed</MenuItem>
                <MenuItem value="review">review</MenuItem>
                <MenuItem value="denied">denied</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField fullWidth label="Фильтр по номеру" value={filterPlate} onChange={(e) => setFilterPlate(e.target.value)} />
            </Grid>
            <Grid item xs={12} md={2}>
              <Button fullWidth variant="outlined" sx={{ height: '100%' }} onClick={() => eventsQuery.refetch()}>Обновить</Button>
            </Grid>
          </Grid>
        </Stack>
      )}
      dataView={(
        <Stack spacing={2}>
          <DataPanel title="Ручной контроль доступа" subtitle="Введите номер и отправьте событие на backend.">
            <Grid container spacing={1.5}>
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="Номер автомобиля" value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} />
              </Grid>
              <Grid item xs={12} md={3}>
                <Button variant="contained" fullWidth sx={{ height: '100%' }} onClick={submitManual} disabled={manualMutation.isPending || parkingLotId === ''}>
                  Отправить событие
                </Button>
              </Grid>
            </Grid>
            {manualMutation.data ? (
              <Alert sx={{ mt: 1.5 }} severity={manualMutation.data.decision === 'allowed' ? 'success' : manualMutation.data.decision === 'review' ? 'warning' : 'error'}>
                Результат: {manualMutation.data.decision} · {manualMutation.data.reason}
              </Alert>
            ) : null}
          </DataPanel>

          <DataPanel title="События доступа" subtitle="Последние события ANPR/LPR.">
            <Stack spacing={1}>
              {(eventsQuery.data?.items ?? []).map((event) => (
                <Box key={event.id} sx={{ border: '1px solid', borderColor: 'border.subtle', borderRadius: 2, p: 1.25 }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} justifyContent="space-between">
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography fontWeight={700}>{event.plate_number}</Typography>
                      <Chip size="small" label={event.direction} variant="outlined" />
                      <Chip size="small" label={event.decision} color={decisionColor[event.decision]} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">{new Date(event.created_at).toLocaleString()}</Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">{event.reason}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    booking_id: {event.booking_id ?? '—'} · spot_id: {event.parking_spot_id ?? '—'} · confidence: {event.recognition_confidence ?? '—'}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </DataPanel>

          <DataPanel title="Последние события (виджет)" subtitle="Компактный блок для dashboard-режима.">
            <Stack spacing={1}>
              {(latestEventsQuery.data?.items ?? []).slice(0, 5).map((event) => (
                <Stack key={event.id} direction="row" justifyContent="space-between" spacing={1}>
                  <Typography variant="body2" noWrap>{event.plate_number} · {event.direction}</Typography>
                  <Chip size="small" label={event.decision} color={decisionColor[event.decision]} />
                </Stack>
              ))}
            </Stack>
          </DataPanel>
        </Stack>
      )}
    />
  );
}
