import { Alert, Box, Button, Chip, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useMemo, useState } from 'react';

import { useParkingLotsQuery } from '../features/parking-lots/use-parking-lots-query';
import {
  useAccessEventsQuery,
  useLatestAccessEventsQuery,
  useManualAccessEventMutation,
  useRecognizeImageAccessEventMutation,
  useRecognizeVideoAccessEventMutation,
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);

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
  const imageMutation = useRecognizeImageAccessEventMutation();
  const videoMutation = useRecognizeVideoAccessEventMutation();

  const submitManual = async () => {
    if (parkingLotId === '' || !plateNumber.trim()) return;
    await manualMutation.mutateAsync({ parking_lot_id: parkingLotId, plate_number: plateNumber, direction });
    setPlateNumber('');
  };

  const submitImage = async () => {
    if (parkingLotId === '' || !imageFile) return;
    await imageMutation.mutateAsync({ file: imageFile, parking_lot_id: parkingLotId, direction });
  };

  const submitVideo = async () => {
    if (parkingLotId === '' || !videoFile) return;
    await videoMutation.mutateAsync({ file: videoFile, parking_lot_id: parkingLotId, direction });
  };

  const latestResult = imageMutation.data ?? videoMutation.data ?? manualMutation.data;

  return (
    <DataListPageTemplate
      title="Контроль доступа"
      subtitle="Распознавание номеров из ручного ввода, изображений и видео."
      filters={(
        <Stack spacing={1.5}>
          <Grid container spacing={1.5}>
            <Grid item xs={12} md={3}>
              <TextField fullWidth select label="Парковка" value={parkingLotId} onChange={(event) => setParkingLotId(event.target.value ? Number(event.target.value) : '')}>
                <MenuItem value="">Все парковки</MenuItem>
                {(parkingLotsQuery.data?.items ?? []).map((lot) => <MenuItem key={lot.id} value={lot.id}>{lot.name}</MenuItem>)}
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
            <Grid item xs={12} md={3}><TextField fullWidth label="Фильтр по номеру" value={filterPlate} onChange={(e) => setFilterPlate(e.target.value)} /></Grid>
            <Grid item xs={12} md={2}><Button fullWidth variant="outlined" sx={{ height: '100%' }} onClick={() => eventsQuery.refetch()}>Обновить</Button></Grid>
          </Grid>
        </Stack>
      )}
      dataView={(
        <Stack spacing={2}>
          <DataPanel title="Ручной ввод номера">
            <Grid container spacing={1.5}>
              <Grid item xs={12} md={4}><TextField fullWidth label="Номер автомобиля" value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} /></Grid>
              <Grid item xs={12} md={3}><Button variant="contained" fullWidth sx={{ height: '100%' }} onClick={submitManual} disabled={manualMutation.isPending || parkingLotId === ''}>Отправить</Button></Grid>
            </Grid>
          </DataPanel>

          <DataPanel title="Распознавание по изображению/видео" subtitle="Загрузите файл, модуль выполнит mock pipeline и создаст событие доступа.">
            <Grid container spacing={1.5}>
              <Grid item xs={12} md={5}>
                <Button component="label" variant="outlined" fullWidth>
                  Выбрать изображение
                  <input hidden type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
                </Button>
                {imageFile ? <Typography variant="caption">{imageFile.name}</Typography> : null}
              </Grid>
              <Grid item xs={12} md={2}><Button variant="contained" fullWidth onClick={submitImage} disabled={!imageFile || parkingLotId === ''}>Распознать image</Button></Grid>
              <Grid item xs={12} md={5}>
                <Button component="label" variant="outlined" fullWidth>
                  Выбрать видео
                  <input hidden type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)} />
                </Button>
                {videoFile ? <Typography variant="caption">{videoFile.name}</Typography> : null}
              </Grid>
              <Grid item xs={12} md={2}><Button variant="contained" fullWidth onClick={submitVideo} disabled={!videoFile || parkingLotId === ''}>Распознать video</Button></Grid>
            </Grid>
          </DataPanel>

          {latestResult ? (
            <Alert severity={latestResult.decision === 'allowed' ? 'success' : latestResult.decision === 'review' ? 'warning' : 'error'}>
              Номер: {latestResult.plate_number}; confidence: {latestResult.recognition_confidence ?? '—'}; user_id: {latestResult.user_id ?? '—'}; vehicle_id: {latestResult.vehicle_id ?? '—'}; booking_id: {latestResult.booking_id ?? '—'}; decision: {latestResult.decision}.
            </Alert>
          ) : null}

          <DataPanel title="События доступа">
            <Stack spacing={1}>
              {(eventsQuery.data?.items ?? []).map((event) => (
                <Box key={event.id} sx={{ border: '1px solid', borderColor: 'border.subtle', borderRadius: 2, p: 1.25 }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} justifyContent="space-between">
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography fontWeight={700}>{event.plate_number}</Typography>
                      <Chip size="small" label={event.direction} variant="outlined" />
                      <Chip size="small" label={event.decision} color={decisionColor[event.decision]} />
                      <Chip size="small" label={event.processing_status} variant="outlined" />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">{new Date(event.created_at).toLocaleString()}</Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">{event.reason}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    user: {event.user_id ?? '—'} · vehicle: {event.vehicle_id ?? '—'} · booking: {event.booking_id ?? '—'} · spot: {event.parking_spot_id ?? '—'}
                  </Typography>
                  {(event.image_url || event.video_url) ? (
                    <Typography variant="caption" display="block" color="text.secondary">media: {event.image_url ?? event.video_url}</Typography>
                  ) : null}
                </Box>
              ))}
            </Stack>
          </DataPanel>

          <DataPanel title="Последние события (виджет)">
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
