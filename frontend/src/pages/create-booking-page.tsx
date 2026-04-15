import { Alert, Button, FormControlLabel, MenuItem, Paper, Radio, RadioGroup, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { parkingSpotsApi } from '../entities/parking-spots/api';
import { recommendationsApi } from '../entities/recommendations/api';
import { useCreateBookingMutation } from '../features/bookings/use-create-booking-mutation';
import { IntervalPicker } from '../features/bookings/components/interval-picker';
import { RecommendationList } from '../features/bookings/components/recommendation-list';
import { AvailabilityTable } from '../features/bookings/components/availability-table';
import { useParkingLotsQuery } from '../features/parking-lots/hooks';
import type { Booking, CreateBookingPayload } from '../shared/types/booking';
import type { ApiError } from '../shared/types/common';
import type { RecommendationRequestPayload, RecommendationResult } from '../shared/types/recommendation';

interface IntervalErrors {
  start?: string;
  end?: string;
}

const spotTypeOptions = ['regular', 'guest', 'disabled', 'ev', 'reserved', 'vip'] as const;
const vehicleTypeOptions = ['car', 'bike', 'truck'] as const;
const sizeCategoryOptions = ['small', 'medium', 'large'] as const;
const weightFieldOptions = ['availability', 'spot_type', 'zone', 'charger', 'role', 'conflict'] as const;

function toApiDateTime(value: string): string {
  return value.length === 16 ? `${value}:00` : value;
}

function parseCsvToNumbers(value: string): number[] | undefined {
  const result = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));

  return result.length > 0 ? result : undefined;
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
    return '400: Некорректные параметры запроса. Проверьте интервал/лот и повторите попытку.';
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

function getRecommendationPayload(
  parkingLotId: number,
  startIso: string,
  endIso: string,
  filterSpotType: string,
  filterZoneIdsCsv: string,
  filterVehicleType: string,
  filterSizeCategory: string,
  requiresCharger: boolean,
  preferredSpotType: string,
  preferredZoneIdsCsv: string,
  preferCharger: boolean,
  needsAccessibleSpot: boolean,
  maxResults: number,
  weights: {
    availability: number;
    spot_type: number;
    zone: number;
    charger: number;
    role: number;
    conflict: number;
  },
): RecommendationRequestPayload {
  return {
    parking_lot_id: parkingLotId,
    from: startIso,
    to: endIso,
    filters: {
      spot_types: filterSpotType ? [filterSpotType as (typeof spotTypeOptions)[number]] : undefined,
      zone_ids: parseCsvToNumbers(filterZoneIdsCsv),
      vehicle_type: filterVehicleType ? (filterVehicleType as (typeof vehicleTypeOptions)[number]) : undefined,
      size_category: filterSizeCategory ? (filterSizeCategory as (typeof sizeCategoryOptions)[number]) : undefined,
      requires_charger: requiresCharger,
    },
    preferences: {
      preferred_spot_types: preferredSpotType ? [preferredSpotType as (typeof spotTypeOptions)[number]] : undefined,
      preferred_zone_ids: parseCsvToNumbers(preferredZoneIdsCsv),
      prefer_charger: preferCharger,
      needs_accessible_spot: needsAccessibleSpot,
      max_results: maxResults,
    },
    weights,
  };
}

export function CreateBookingPage() {
  const navigate = useNavigate();

  const [startTimeLocal, setStartTimeLocal] = useState('');
  const [endTimeLocal, setEndTimeLocal] = useState('');
  const [parkingLotId, setParkingLotId] = useState<number | ''>('');
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');
  const [selectedSpotId, setSelectedSpotId] = useState<number | undefined>();
  const [successBooking, setSuccessBooking] = useState<Booking | null>(null);

  const [requiresCharger, setRequiresCharger] = useState(false);
  const [preferCharger, setPreferCharger] = useState(false);
  const [needsAccessibleSpot, setNeedsAccessibleSpot] = useState(false);
  const [maxResults, setMaxResults] = useState(5);
  const [filterSpotType, setFilterSpotType] = useState<string>('');
  const [filterVehicleType, setFilterVehicleType] = useState<string>('');
  const [filterSizeCategory, setFilterSizeCategory] = useState<string>('');
  const [filterZoneIdsCsv, setFilterZoneIdsCsv] = useState('');
  const [preferredSpotType, setPreferredSpotType] = useState<string>('');
  const [preferredZoneIdsCsv, setPreferredZoneIdsCsv] = useState('');
  const [weights, setWeights] = useState({
    availability: 0.35,
    spot_type: 0.15,
    zone: 0.10,
    charger: 0.10,
    role: 0.20,
    conflict: 0.10,
  });

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
        status: 'available',
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
      navigate('/my-bookings');
    }, 1600);

    return () => clearTimeout(timeoutId);
  }, [navigate, successBooking]);

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
        spot_types: filterSpotType ? [filterSpotType as (typeof spotTypeOptions)[number]] : undefined,
        zone_ids: parseCsvToNumbers(filterZoneIdsCsv),
        vehicle_type: filterVehicleType ? (filterVehicleType as (typeof vehicleTypeOptions)[number]) : undefined,
        size_category: filterSizeCategory ? (filterSizeCategory as (typeof sizeCategoryOptions)[number]) : undefined,
        requires_charger: requiresCharger,
      },
      recommendation_preferences: {
        preferred_spot_types: preferredSpotType ? [preferredSpotType as (typeof spotTypeOptions)[number]] : undefined,
        preferred_zone_ids: parseCsvToNumbers(preferredZoneIdsCsv),
        prefer_charger: preferCharger,
        needs_accessible_spot: needsAccessibleSpot,
        max_results: maxResults,
      },
      recommendation_weights: weights,
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
        filterSpotType,
        filterZoneIdsCsv,
        filterVehicleType,
        filterSizeCategory,
        requiresCharger,
        preferredSpotType,
        preferredZoneIdsCsv,
        preferCharger,
        needsAccessibleSpot,
        maxResults,
        weights,
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
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2.5}>
        <Typography variant="h5">Создание бронирования</Typography>

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
        >
          {parkingLotsQuery.data?.items.map((lot) => (
            <MenuItem key={lot.id} value={lot.id}>{lot.name} (#{lot.id})</MenuItem>
          ))}
        </TextField>

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
              <TextField
                select
                label="Needs accessible spot"
                value={needsAccessibleSpot ? 'yes' : 'no'}
                onChange={(event) => setNeedsAccessibleSpot(event.target.value === 'yes')}
                sx={{ maxWidth: 240 }}
              >
                <MenuItem value="no">No</MenuItem>
                <MenuItem value="yes">Yes</MenuItem>
              </TextField>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                select
                label="Filter spot type"
                value={filterSpotType}
                onChange={(event) => setFilterSpotType(event.target.value)}
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="">Any</MenuItem>
                {spotTypeOptions.map((spotType) => (
                  <MenuItem key={spotType} value={spotType}>{spotType}</MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Filter vehicle type"
                value={filterVehicleType}
                onChange={(event) => setFilterVehicleType(event.target.value)}
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="">Any</MenuItem>
                {vehicleTypeOptions.map((vehicleType) => (
                  <MenuItem key={vehicleType} value={vehicleType}>{vehicleType}</MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Filter size category"
                value={filterSizeCategory}
                onChange={(event) => setFilterSizeCategory(event.target.value)}
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="">Any</MenuItem>
                {sizeCategoryOptions.map((sizeCategory) => (
                  <MenuItem key={sizeCategory} value={sizeCategory}>{sizeCategory}</MenuItem>
                ))}
              </TextField>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="Filter zone IDs"
                placeholder="1,2,3"
                value={filterZoneIdsCsv}
                onChange={(event) => setFilterZoneIdsCsv(event.target.value)}
                helperText="Через запятую"
                sx={{ minWidth: 260 }}
              />
              <TextField
                select
                label="Preferred spot type"
                value={preferredSpotType}
                onChange={(event) => setPreferredSpotType(event.target.value)}
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="">Any</MenuItem>
                {spotTypeOptions.map((spotType) => (
                  <MenuItem key={spotType} value={spotType}>{spotType}</MenuItem>
                ))}
              </TextField>
              <TextField
                label="Preferred zone IDs"
                placeholder="5,8"
                value={preferredZoneIdsCsv}
                onChange={(event) => setPreferredZoneIdsCsv(event.target.value)}
                helperText="Через запятую"
                sx={{ minWidth: 260 }}
              />
            </Stack>

            <Stack spacing={1}>
              <Typography variant="subtitle2">Weights</Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap">
                {weightFieldOptions.map((fieldName) => (
                  <TextField
                    key={fieldName}
                    type="number"
                    inputProps={{ min: 0, max: 1, step: 0.05 }}
                    label={fieldName}
                    value={weights[fieldName]}
                    onChange={(event) =>
                      setWeights((prev) => ({
                        ...prev,
                        [fieldName]: Math.max(0, Math.min(1, Number(event.target.value) || 0)),
                      }))
                    }
                    sx={{ maxWidth: 170 }}
                  />
                ))}
              </Stack>
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
