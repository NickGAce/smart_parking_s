import { Alert, Button, Divider, FormControlLabel, Grid, MenuItem, Radio, RadioGroup, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { parkingSpotsApi } from '../entities/parking-spots/api';
import { recommendationsApi } from '../entities/recommendations/api';
import { useCurrentUser } from '../features/auth/use-current-user';
import { AvailabilityTable } from '../features/bookings/components/availability-table';
import { IntervalPicker } from '../features/bookings/components/interval-picker';
import { RecommendationList } from '../features/bookings/components/recommendation-list';
import { useCreateBookingMutation } from '../features/bookings/use-create-booking-mutation';
import { useParkingLotsQuery } from '../features/parking-lots/hooks';
import { bookingAssignmentModeLabelMap } from '../shared/config/booking-ui';
import { ActionBar } from '../shared/ui/action-bar';
import { FormSection } from '../shared/ui/form-section';
import { FormPageTemplate } from '../shared/ui/page-templates';
import type { Booking, CreateBookingPayload } from '../shared/types/booking';
import type { ApiError } from '../shared/types/common';
import type { RecommendationRequestPayload, RecommendationResult } from '../shared/types/recommendation';
import type { SizeCategory, SpotType, UserRole, VehicleType } from '../shared/types/common';

interface IntervalErrors {
  start?: string;
  end?: string;
}

function toApiDateTime(value: string): string {
  return value;
}

function validateInterval(startTimeLocal: string, endTimeLocal: string): IntervalErrors {
  const errors: IntervalErrors = {};

  if (!startTimeLocal) {
    errors.start = 'Укажите время начала.';
  }

  if (!endTimeLocal) {
    errors.end = 'Укажите время окончания.';
  }

  if (!startTimeLocal || !endTimeLocal) {
    return errors;
  }

  const start = new Date(startTimeLocal);
  const end = new Date(endTimeLocal);

  if (Number.isNaN(start.valueOf())) {
    errors.start = 'Некорректный формат даты.';
  }

  if (Number.isNaN(end.valueOf())) {
    errors.end = 'Некорректный формат даты.';
  }

  if (!errors.start && !errors.end && start >= end) {
    errors.end = 'Окончание должно быть позже начала.';
  }

  return errors;
}

function getStatusErrorMessage(error: ApiError | null): string | null {
  if (!error) {
    return null;
  }

  if (error.status === 400) {
    return error.detail ?? 'Проверьте выбранный интервал и параметры парковки.';
  }

  if (error.status === 403) {
    return 'Недостаточно прав для бронирования выбранной парковки или места.';
  }

  if (error.status === 409) {
    return 'Интервал пересекается с другим бронированием. Выберите другое время или место.';
  }

  if (error.status === 422) {
    const details = error.fieldErrors?.map((item) => `${item.loc.join('.')}: ${item.msg}`).join('; ');
    return `Проверьте заполнение полей.${details ? ` ${details}` : ''}`;
  }

  return error.message;
}

const SPOT_TYPE_OPTIONS: SpotType[] = ['regular', 'guest', 'disabled', 'ev', 'reserved', 'vip'];
const VEHICLE_TYPE_OPTIONS: VehicleType[] = ['car', 'bike', 'truck'];
const SIZE_CATEGORY_OPTIONS: SizeCategory[] = ['small', 'medium', 'large'];

const NEXT_ROUTE_BY_ROLE: Record<UserRole, string> = {
  admin: '/booking-management',
  owner: '/booking-management',
  tenant: '/my-bookings',
  guard: '/booking-management',
  uk: '/my-bookings',
};

function getRecommendationPayload(
  parkingLotId: number,
  startIso: string,
  endIso: string,
  requiresCharger: boolean,
  preferCharger: boolean,
  maxResults: number,
  spotTypes: SpotType[],
  vehicleType: VehicleType | '',
  sizeCategory: SizeCategory | '',
): RecommendationRequestPayload {
  return {
    parking_lot_id: parkingLotId,
    from: startIso,
    to: endIso,
    filters: {
      requires_charger: requiresCharger,
      spot_types: spotTypes.length ? spotTypes : undefined,
      vehicle_type: vehicleType || undefined,
      size_category: sizeCategory || undefined,
    },
    preferences: {
      prefer_charger: preferCharger,
      preferred_spot_types: spotTypes.length ? spotTypes : undefined,
      max_results: maxResults,
    },
  };
}

export function CreateBookingPage() {
  const navigate = useNavigate();
  const { role = 'tenant' } = useCurrentUser();

  const [startTimeLocal, setStartTimeLocal] = useState('');
  const [endTimeLocal, setEndTimeLocal] = useState('');
  const [parkingLotId, setParkingLotId] = useState<number | ''>('');
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');
  const [selectedSpotId, setSelectedSpotId] = useState<number | undefined>();
  const [successBooking, setSuccessBooking] = useState<Booking | null>(null);

  const [requiresCharger, setRequiresCharger] = useState(false);
  const [preferCharger, setPreferCharger] = useState(false);
  const [maxResults, setMaxResults] = useState(5);
  const [spotTypes, setSpotTypes] = useState<SpotType[]>([]);
  const [vehicleType, setVehicleType] = useState<VehicleType | ''>('');
  const [sizeCategory, setSizeCategory] = useState<SizeCategory | ''>('');

  const intervalErrors = useMemo(() => validateInterval(startTimeLocal, endTimeLocal), [startTimeLocal, endTimeLocal]);

  const hasIntervalErrors = Boolean(intervalErrors.start || intervalErrors.end);
  const hasValidSelection = typeof parkingLotId === 'number' && !hasIntervalErrors;

  const parkingLotsQuery = useParkingLotsQuery({ limit: 100, offset: 0, sort_by: 'name', sort_order: 'asc' });

  const availableSpotsQuery = useQuery({
    queryKey: ['booking-create-spots', parkingLotId, startTimeLocal, endTimeLocal],
    queryFn: () =>
      parkingSpotsApi.getSpots({
        parking_lot_id: parkingLotId as number,
        from: toApiDateTime(startTimeLocal),
        to: toApiDateTime(endTimeLocal),
        limit: 100,
        offset: 0,
      }),
    enabled: mode === 'manual' && hasValidSelection,
  });

  const recommendationsMutation = useMutation<RecommendationResult, ApiError, RecommendationRequestPayload>({
    mutationFn: recommendationsApi.getSpotRecommendations,
  });

  const createBookingMutation = useCreateBookingMutation();

  useEffect(() => {
    setSelectedSpotId(undefined);
  }, [mode, parkingLotId, startTimeLocal, endTimeLocal]);

  useEffect(() => {
    if (!successBooking) {
      return;
    }
    const timeoutId = setTimeout(() => {
      navigate(NEXT_ROUTE_BY_ROLE[role] ?? '/my-bookings');
    }, 1600);

    return () => clearTimeout(timeoutId);
  }, [navigate, role, successBooking]);

  const bookingErrorMessage = getStatusErrorMessage(createBookingMutation.error ?? null);
  const recommendationErrorMessage = getStatusErrorMessage(recommendationsMutation.error ?? null);

  const submitManual = () => {
    if (!hasValidSelection || !selectedSpotId) {
      return;
    }

    const payload: CreateBookingPayload = {
      start_time: toApiDateTime(startTimeLocal),
      end_time: toApiDateTime(endTimeLocal),
      parking_spot_id: selectedSpotId,
      auto_assign: false,
      parking_lot_id: parkingLotId as number,
    };

    createBookingMutation.mutate(payload, {
      onSuccess: (booking) => {
        setSuccessBooking(booking);
      },
    });
  };

  const submitAuto = () => {
    if (!hasValidSelection) {
      return;
    }

    const payload: CreateBookingPayload = {
      start_time: toApiDateTime(startTimeLocal),
      end_time: toApiDateTime(endTimeLocal),
      auto_assign: true,
      parking_lot_id: parkingLotId as number,
      recommendation_filters: {
        requires_charger: requiresCharger,
        spot_types: spotTypes.length ? spotTypes : undefined,
        vehicle_type: vehicleType || undefined,
        size_category: sizeCategory || undefined,
      },
      recommendation_preferences: {
        prefer_charger: preferCharger,
        preferred_spot_types: spotTypes.length ? spotTypes : undefined,
        max_results: maxResults,
      },
    };

    createBookingMutation.mutate(payload, {
      onSuccess: (booking) => {
        setSuccessBooking(booking);
      },
    });
  };

  const submitRecommendedSpot = () => {
    if (!hasValidSelection || !selectedSpotId) {
      return;
    }

    const payload: CreateBookingPayload = {
      start_time: toApiDateTime(startTimeLocal),
      end_time: toApiDateTime(endTimeLocal),
      parking_spot_id: selectedSpotId,
      parking_lot_id: parkingLotId as number,
      auto_assign: false,
    };

    createBookingMutation.mutate(payload, {
      onSuccess: (booking) => {
        setSuccessBooking(booking);
      },
    });
  };

  const requestRecommendations = () => {
    if (!hasValidSelection) {
      return;
    }

    recommendationsMutation.mutate(
      getRecommendationPayload(
        parkingLotId as number,
        toApiDateTime(startTimeLocal),
        toApiDateTime(endTimeLocal),
        requiresCharger,
        preferCharger,
        maxResults,
        spotTypes,
        vehicleType,
        sizeCategory,
      ),
    );
  };

  if (successBooking) {
    return (
      <FormPageTemplate
        title={`Бронирование #${successBooking.id} создано`}
        subtitle="Заявка успешно сохранена. Сейчас вы будете перенаправлены в список бронирований."
        helperText={<Alert severity="success">Режим назначения: {bookingAssignmentModeLabelMap[successBooking.assignment_mode] ?? successBooking.assignment_mode}.</Alert>}
        formSections={(
          <FormSection title="Результат" subtitle="Сводка по выполненной операции.">
            <Stack spacing={1.5}>
              {successBooking.assignment_explanation && <Alert severity="info">{successBooking.assignment_explanation}</Alert>}
              {successBooking.assignment_metadata && <Alert severity="info">Технические метаданные назначения: {JSON.stringify(successBooking.assignment_metadata, null, 2)}</Alert>}
            </Stack>
          </FormSection>
        )}
        stickyActions={(
          <ActionBar
            actions={(
              <>
                <Button variant="contained" onClick={() => navigate(NEXT_ROUTE_BY_ROLE[role] ?? '/my-bookings')}>К списку бронирований</Button>
                <Button variant="outlined" onClick={() => navigate('/bookings/new')}>Создать ещё одно</Button>
              </>
            )}
          />
        )}
      />
    );
  }

  return (
    <FormPageTemplate
      title="Создание бронирования"
      subtitle="Сначала выберите период и парковку, затем режим назначения места — ручной или автоматический."
      helperText={<Alert severity="info">Мы не меняем бизнес-логику: экран только упрощает принятие решения и снижает риск ошибки ввода.</Alert>}
      formSections={(
        <>
          <FormSection title="1. Время и парковка" subtitle="Базовые параметры заявки, обязательные в любом режиме.">
            <IntervalPicker
              startTimeLocal={startTimeLocal}
              endTimeLocal={endTimeLocal}
              onStartTimeChange={setStartTimeLocal}
              onEndTimeChange={setEndTimeLocal}
              startError={intervalErrors.start}
              endError={intervalErrors.end}
            />

            <TextField
              select
              label="Парковка"
              value={parkingLotId}
              onChange={(event) => setParkingLotId(Number(event.target.value))}
              helperText="Выберите лот, в котором нужно найти место на указанный интервал."
              disabled={parkingLotsQuery.isLoading || !parkingLotsQuery.data?.items.length}
            >
              {parkingLotsQuery.data?.items.map((lot) => (
                <MenuItem key={lot.id} value={lot.id}>{lot.name} (#{lot.id})</MenuItem>
              ))}
            </TextField>
            {parkingLotsQuery.isError && <Alert severity="error">Не удалось загрузить список парковок. Попробуйте позже.</Alert>}
            {!parkingLotsQuery.isLoading && !parkingLotsQuery.isError && parkingLotsQuery.data?.items.length === 0 && (
              <Alert severity="warning">Нет доступных парковок для бронирования. Обратитесь к администратору.</Alert>
            )}
          </FormSection>

          <FormSection title="2. Способ назначения места" subtitle="Выберите удобный сценарий бронирования.">
            <RadioGroup row value={mode} onChange={(event) => setMode(event.target.value as 'manual' | 'auto')}>
              <FormControlLabel value="manual" control={<Radio />} label="Ручной выбор" />
              <FormControlLabel value="auto" control={<Radio />} label="Автоподбор" />
            </RadioGroup>
            <Typography variant="body2" color="text.secondary">
              {mode === 'manual'
                ? 'Ручной режим подходит, когда вы точно знаете, какое место нужно выбрать.'
                : 'Автоподбор учитывает ограничения и предпочтения, чтобы предложить лучшие варианты.'}
            </Typography>
            {bookingErrorMessage && <Alert severity="error">{bookingErrorMessage}</Alert>}
          </FormSection>

          {mode === 'manual' && (
            <FormSection title="3. Выберите место" subtitle="Нажмите на строку в таблице, чтобы выбрать свободное место.">
              {availableSpotsQuery.error && <Alert severity="error">{getStatusErrorMessage(availableSpotsQuery.error as unknown as ApiError)}</Alert>}
              <AvailabilityTable items={availableSpotsQuery.data?.items ?? []} selectedSpotId={selectedSpotId} onSelect={setSelectedSpotId} />
            </FormSection>
          )}

          {mode === 'auto' && (
            <FormSection title="3. Параметры автоподбора" subtitle="Настройте ограничения и предпочтения перед запросом рекомендаций.">
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    type="number"
                    label="Максимум рекомендаций"
                    value={maxResults}
                    onChange={(event) => setMaxResults(Math.max(1, Number(event.target.value) || 1))}
                    fullWidth
                    helperText="Обычно достаточно 3–5 вариантов."
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField select label="Зарядка обязательна" value={requiresCharger ? 'yes' : 'no'} onChange={(event) => setRequiresCharger(event.target.value === 'yes')} fullWidth>
                    <MenuItem value="no">Нет</MenuItem>
                    <MenuItem value="yes">Да</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField select label="Зарядка желательна" value={preferCharger ? 'yes' : 'no'} onChange={(event) => setPreferCharger(event.target.value === 'yes')} fullWidth>
                    <MenuItem value="no">Нет</MenuItem>
                    <MenuItem value="yes">Да</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField select label="Тип транспорта" value={vehicleType} onChange={(event) => setVehicleType(event.target.value as VehicleType | '')} fullWidth>
                    <MenuItem value="">Любой</MenuItem>
                    {VEHICLE_TYPE_OPTIONS.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField select label="Размер места" value={sizeCategory} onChange={(event) => setSizeCategory(event.target.value as SizeCategory | '')} fullWidth>
                    <MenuItem value="">Любой</MenuItem>
                    {SIZE_CATEGORY_OPTIONS.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    select
                    label="Типы мест"
                    SelectProps={{ multiple: true }}
                    value={spotTypes}
                    onChange={(event) => {
                      const next = event.target.value;
                      setSpotTypes(Array.isArray(next) ? (next as SpotType[]) : (String(next).split(',') as SpotType[]));
                    }}
                    fullWidth
                  >
                    {SPOT_TYPE_OPTIONS.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
                  </TextField>
                </Grid>
              </Grid>
              <Divider />
              <Stack spacing={1.5}>
                <Button variant="outlined" onClick={requestRecommendations} disabled={!hasValidSelection || recommendationsMutation.isPending}>
                  Получить рекомендации
                </Button>
                {recommendationErrorMessage && <Alert severity="error">{recommendationErrorMessage}</Alert>}
                {recommendationsMutation.data && (
                  <RecommendationList
                    result={recommendationsMutation.data}
                    selectedSpotId={selectedSpotId}
                    onSelectSpot={setSelectedSpotId}
                    onConfirmAuto={submitAuto}
                    isSubmitting={createBookingMutation.isPending}
                  />
                )}
              </Stack>
            </FormSection>
          )}
        </>
      )}
      stickyActions={(
        <ActionBar
          actions={(
            <>
              {mode === 'manual' ? (
                <Button variant="contained" onClick={submitManual} disabled={!selectedSpotId || createBookingMutation.isPending || !hasValidSelection}>
                  Создать бронирование
                </Button>
              ) : (
                <>
                  <Button variant="contained" onClick={submitAuto} disabled={!hasValidSelection || createBookingMutation.isPending}>
                    Создать с автоподбором
                  </Button>
                  <Button variant="outlined" disabled={!selectedSpotId || createBookingMutation.isPending} onClick={submitRecommendedSpot}>
                    Создать по выбранной рекомендации
                  </Button>
                </>
              )}
            </>
          )}
        >
          <Typography variant="body2" color="text.secondary">
            Проверьте интервал и парковку перед отправкой. Если видите конфликт — измените время или выберите другое место.
          </Typography>
        </ActionBar>
      )}
    />
  );
}
