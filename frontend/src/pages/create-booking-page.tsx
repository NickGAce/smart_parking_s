import { Alert, Button, FormControlLabel, MenuItem, Paper, Radio, RadioGroup, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { parkingSpotsApi } from '../entities/parking-spots/api';
import { recommendationsApi } from '../entities/recommendations/api';
import { useCurrentUser } from '../features/auth/use-current-user';
import { useCreateBookingMutation } from '../features/bookings/use-create-booking-mutation';
import { IntervalPicker } from '../features/bookings/components/interval-picker';
import { RecommendationList } from '../features/bookings/components/recommendation-list';
import { AvailabilityTable } from '../features/bookings/components/availability-table';
import { useParkingLotsQuery } from '../features/parking-lots/hooks';
import type { Booking, CreateBookingPayload } from '../shared/types/booking';
import type { ApiError } from '../shared/types/common';
import type { RecommendationRequestPayload, RecommendationResult } from '../shared/types/recommendation';
import type { SizeCategory, SpotType, UserRole, VehicleType } from '../shared/types/common';

interface IntervalErrors {
  start?: string;
  end?: string;
}

function toApiDateTime(value: string): string {
  // Keep browser-local wall clock time (YYYY-MM-DDTHH:mm) so backend timezone normalization
  // does not receive UTC-converted values and shift the booking window.
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
    return `400: ${error.detail ?? 'Некорректные параметры запроса. Проверьте интервал/лот и повторите попытку.'}`;
  }

  if (error.status === 403) {
    return '403: Недостаточно прав для бронирования выбранного лота/места.';
  }

  if (error.status === 409) {
    return '409: Конфликт доступности. Интервал пересекается или место уже занято. Обновите данные и выберите другой вариант.';
  }

  if (error.status === 422) {
    const details = error.fieldErrors?.map((item) => `${item.loc.join('.')}: ${item.msg}`).join('; ');
    return `422: Ошибка валидации.${details ? ` ${details}` : ''}`;
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

  const intervalErrors = useMemo(
    () => validateInterval(startTimeLocal, endTimeLocal),
    [startTimeLocal, endTimeLocal],
  );

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
      <Paper sx={{ p: 3 }}>
        <Stack spacing={1.5}>
          <Alert severity="success">
            Бронирование #{successBooking.id} успешно создано. Режим назначения: {successBooking.assignment_mode}.
          </Alert>
          {successBooking.assignment_explanation && <Alert severity="info">{successBooking.assignment_explanation}</Alert>}
          {successBooking.assignment_metadata && (
            <Alert severity="info">Metadata: {JSON.stringify(successBooking.assignment_metadata, null, 2)}</Alert>
          )}
          <Button variant="contained" onClick={() => navigate('/my-bookings')}>Перейти в My bookings</Button>
          <Button variant="outlined" onClick={() => navigate(NEXT_ROUTE_BY_ROLE[role] ?? '/my-bookings')}>
            Перейти к списку бронирований
          </Button>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2.5}>
        <Typography variant="h5">Создание бронирования</Typography>
        <Alert severity="info">
          Выберите интервал и парковку, затем создайте бронь вручную или через рекомендательную логику.
        </Alert>

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
          label="Parking lot"
          value={parkingLotId}
          onChange={(event) => setParkingLotId(Number(event.target.value))}
          helperText="Выберите лот для ручного или auto назначения"
          disabled={parkingLotsQuery.isLoading || !parkingLotsQuery.data?.items.length}
        >
          {parkingLotsQuery.data?.items.map((lot) => (
            <MenuItem key={lot.id} value={lot.id}>{lot.name} (#{lot.id})</MenuItem>
          ))}
        </TextField>
        {parkingLotsQuery.isError && (
          <Alert severity="error">
            Не удалось загрузить список парковок. Без этого шага создать бронирование нельзя.
          </Alert>
        )}
        {!parkingLotsQuery.isLoading && !parkingLotsQuery.isError && parkingLotsQuery.data?.items.length === 0 && (
          <Alert severity="warning">
            Нет доступных парковок для бронирования. Попросите администратора создать парковку и места.
          </Alert>
        )}

        <Stack spacing={0.5}>
          <Typography variant="subtitle2">Режим назначения</Typography>
          <RadioGroup row value={mode} onChange={(event) => setMode(event.target.value as 'manual' | 'auto')}>
            <FormControlLabel value="manual" control={<Radio />} label="manual (выбор места вручную)" />
            <FormControlLabel value="auto" control={<Radio />} label="auto (рекомендации + auto_assign)" />
          </RadioGroup>
        </Stack>

        {bookingErrorMessage && <Alert severity="error">{bookingErrorMessage}</Alert>}

        {mode === 'manual' && (
          <Stack spacing={1.5}>
            <Typography variant="h6">Ручной выбор места</Typography>
            {availableSpotsQuery.error && (
              <Alert severity="error">{getStatusErrorMessage(availableSpotsQuery.error as unknown as ApiError)}</Alert>
            )}
            <AvailabilityTable
              items={availableSpotsQuery.data?.items ?? []}
              selectedSpotId={selectedSpotId}
              onSelect={setSelectedSpotId}
            />
            <Button
              variant="contained"
              onClick={submitManual}
              disabled={!selectedSpotId || createBookingMutation.isPending || !hasValidSelection}
            >
              Создать бронирование (manual)
            </Button>
          </Stack>
        )}

        {mode === 'auto' && (
          <Stack spacing={1.5}>
            <Typography variant="h6">Авто-подбор места</Typography>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                type="number"
                label="Max results"
                value={maxResults}
                onChange={(event) => setMaxResults(Math.max(1, Number(event.target.value) || 1))}
                sx={{ maxWidth: 180 }}
              />
              <TextField
                select
                label="Requires charger"
                value={requiresCharger ? 'yes' : 'no'}
                onChange={(event) => setRequiresCharger(event.target.value === 'yes')}
                sx={{ maxWidth: 220 }}
              >
                <MenuItem value="no">No</MenuItem>
                <MenuItem value="yes">Yes</MenuItem>
              </TextField>
              <TextField
                select
                label="Prefer charger"
                value={preferCharger ? 'yes' : 'no'}
                onChange={(event) => setPreferCharger(event.target.value === 'yes')}
                sx={{ maxWidth: 220 }}
              >
                <MenuItem value="no">No</MenuItem>
                <MenuItem value="yes">Yes</MenuItem>
              </TextField>
            </Stack>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                select
                label="Vehicle type"
                value={vehicleType}
                onChange={(event) => setVehicleType(event.target.value as VehicleType | '')}
                sx={{ maxWidth: 220 }}
              >
                <MenuItem value="">Any</MenuItem>
                {VEHICLE_TYPE_OPTIONS.map((option) => (
                  <MenuItem key={option} value={option}>{option}</MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Size category"
                value={sizeCategory}
                onChange={(event) => setSizeCategory(event.target.value as SizeCategory | '')}
                sx={{ maxWidth: 220 }}
              >
                <MenuItem value="">Any</MenuItem>
                {SIZE_CATEGORY_OPTIONS.map((option) => (
                  <MenuItem key={option} value={option}>{option}</MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Spot types"
                SelectProps={{ multiple: true }}
                value={spotTypes}
                onChange={(event) => {
                  const next = event.target.value;
                  setSpotTypes(Array.isArray(next) ? (next as SpotType[]) : String(next).split(',') as SpotType[]);
                }}
                sx={{ minWidth: 260 }}
              >
                {SPOT_TYPE_OPTIONS.map((option) => (
                  <MenuItem key={option} value={option}>{option}</MenuItem>
                ))}
              </TextField>
            </Stack>

            <Button variant="outlined" onClick={requestRecommendations} disabled={!hasValidSelection || recommendationsMutation.isPending}>
              Получить рекомендации
            </Button>

            {recommendationErrorMessage && <Alert severity="error">{recommendationErrorMessage}</Alert>}

            {recommendationsMutation.data && (
              <>
                <RecommendationList
                  result={recommendationsMutation.data}
                  selectedSpotId={selectedSpotId}
                  onSelectSpot={setSelectedSpotId}
                  onConfirmAuto={submitAuto}
                  isSubmitting={createBookingMutation.isPending}
                />
                <Button
                  variant="contained"
                  disabled={!selectedSpotId || createBookingMutation.isPending}
                  onClick={submitRecommendedSpot}
                >
                  Создать бронирование по выбранной рекомендации
                </Button>
              </>
            )}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
