import { Alert, Button, Divider, FormControlLabel, Grid, MenuItem, Radio, RadioGroup, Slider, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { parkingSpotsApi } from '../entities/parking-spots/api';
import { recommendationsApi } from '../entities/recommendations/api';
import { useCurrentUser } from '../features/auth/use-current-user';
import { AvailabilityTable } from '../features/bookings/components/availability-table';
import { IntervalPicker } from '../features/bookings/components/interval-picker';
import { RecommendationList } from '../features/bookings/components/recommendation-list';
import { DecisionReportPanel } from '../features/bookings/components/decision-report-panel';
import { useCreateBookingMutation } from '../features/bookings/use-create-booking-mutation';
import { useParkingLotsQuery } from '../features/parking-lots/hooks';
import { useVehiclesQuery } from '../features/vehicles/hooks';
import { bookingAssignmentModeLabelMap } from '../shared/config/booking-ui';
import { ActionBar } from '../shared/ui/action-bar';
import { FormSection } from '../shared/ui/form-section';
import { FormPageTemplate } from '../shared/ui/page-templates';
import type { Booking, CreateBookingPayload, RecommendationWeights } from '../shared/types/booking';
import type { ApiError } from '../shared/types/common';
import type { RecommendationRequestPayload, RecommendationResult } from '../shared/types/recommendation';
import type { SizeCategory, SpotType, UserRole, VehicleType } from '../shared/types/common';

interface IntervalErrors {
  start?: string;
  end?: string;
}

function toApiDateTime(value: string): string {
  if (!value) {
    return value;
  }
  const normalized = value.length === 16 ? `${value}:00` : value;
  return normalized;
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
const SPOT_TYPE_LABELS: Record<SpotType, string> = {
  regular: 'Обычное',
  guest: 'Гостевое',
  disabled: 'Для МГН',
  ev: 'Электро',
  reserved: 'Служебное',
  vip: 'VIP',
};
const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  car: 'Автомобиль',
  bike: 'Мото/вело',
  truck: 'Грузовой',
};
const SIZE_CATEGORY_LABELS: Record<SizeCategory, string> = {
  small: 'Малый',
  medium: 'Средний',
  large: 'Большой',
};

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
  zoneIds: number[],
  vehicleType: VehicleType | '',
  sizeCategory: SizeCategory | '',
  weights: RecommendationWeights,
): RecommendationRequestPayload {
  return {
    parking_lot_id: parkingLotId,
    from: startIso,
    to: endIso,
    filters: {
      requires_charger: requiresCharger ? true : undefined,
      zone_ids: zoneIds.length ? zoneIds : undefined,
      vehicle_type: vehicleType || undefined,
      size_category: sizeCategory || undefined,
    },
    preferences: {
      prefer_charger: preferCharger,
      preferred_spot_types: spotTypes.length ? spotTypes : undefined,
      max_results: maxResults,
    },
    weights,
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
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | ''>('');

  const [requiresCharger, setRequiresCharger] = useState(false);
  const [preferCharger, setPreferCharger] = useState(false);
  const [maxResults, setMaxResults] = useState(5);
  const [spotTypes, setSpotTypes] = useState<SpotType[]>([]);
  const [vehicleType, setVehicleType] = useState<VehicleType | ''>('');
  const [sizeCategory, setSizeCategory] = useState<SizeCategory | ''>('');
  const [selectedZoneIds, setSelectedZoneIds] = useState<number[]>([]);
  const [recommendationWeights, setRecommendationWeights] = useState<RecommendationWeights>({
    availability: 0.35,
    spot_type: 0.15,
    zone: 0.1,
    charger: 0.1,
    role: 0.2,
    conflict: 0.1,
  });

  const intervalErrors = useMemo(() => validateInterval(startTimeLocal, endTimeLocal), [startTimeLocal, endTimeLocal]);

  const hasIntervalErrors = Boolean(intervalErrors.start || intervalErrors.end);
  const hasValidSelection = typeof parkingLotId === 'number' && !hasIntervalErrors;

  const parkingLotsQuery = useParkingLotsQuery({ limit: 100, offset: 0, sort_by: 'name', sort_order: 'asc' });
  const vehiclesQuery = useVehiclesQuery();

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
  const zoneOptionsQuery = useQuery({
    queryKey: ['booking-create-zones', parkingLotId],
    queryFn: () =>
      parkingSpotsApi.getSpots({
        parking_lot_id: parkingLotId as number,
        limit: 100,
        offset: 0,
      }),
    enabled: typeof parkingLotId === 'number',
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
  const primaryVehicle = (vehiclesQuery.data ?? []).find((vehicle) => vehicle.is_primary) ?? (vehiclesQuery.data ?? [])[0];
  const effectiveVehicleId = selectedVehicleId === '' ? primaryVehicle?.id : selectedVehicleId;
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
      vehicle_id: effectiveVehicleId,
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
      vehicle_id: effectiveVehicleId,
      recommendation_filters: {
        requires_charger: requiresCharger ? true : undefined,
        zone_ids: selectedZoneIds.length ? selectedZoneIds : undefined,
        vehicle_type: vehicleType || undefined,
        size_category: sizeCategory || undefined,
      },
      recommendation_preferences: {
        prefer_charger: preferCharger,
        preferred_spot_types: spotTypes.length ? spotTypes : undefined,
        max_results: maxResults,
      },
      recommendation_weights: recommendationWeights,
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
      vehicle_id: effectiveVehicleId,
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
        selectedZoneIds,
        vehicleType,
        sizeCategory,
        recommendationWeights,
      ),
    );
  };

  const zoneOptions = useMemo(() => {
    const source = zoneOptionsQuery.data?.items ?? [];
    const map = new Map<number, string>();
    source.forEach((spot) => {
      if (typeof spot.zone_id === 'number') {
        map.set(spot.zone_id, spot.zone_name ?? `Зона #${spot.zone_id}`);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [zoneOptionsQuery.data?.items]);

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
              {successBooking.assignment_metadata && <Alert severity="info">Служебные детали назначения сохранены.</Alert>}
              {successBooking.decision_report && <DecisionReportPanel report={successBooking.decision_report} title="Отчет автоподбора места" />}
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
      maxWidth="100%"
      title="Создание бронирования"
      subtitle="Сначала выберите период и парковку, затем режим назначения места — ручной или автоматический."
      helperText={<Alert severity="info">Мы не меняем бизнес-логику: экран только упрощает принятие решения и снижает риск ошибки ввода.</Alert>}
      formSections={(
        <Stack spacing={3}>
          <FormSection title="1. Время и парковка" subtitle="Базовые параметры заявки, обязательные в любом режиме." sx={{ p: { xs: 2.5, md: 3.25 } }}>
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


          <FormSection
            title="1.1 Автомобиль"
            subtitle="Выберите автомобиль; если не выбрать, будет использован primary."
            sx={{ p: { xs: 2.5, md: 3.25 } }}
          >
            <TextField
              fullWidth
              select
              label="Автомобиль"
              value={selectedVehicleId}
              onChange={(event) => setSelectedVehicleId(event.target.value ? Number(event.target.value) : '')}
              helperText={primaryVehicle ? `Primary по умолчанию: ${primaryVehicle.plate_number}` : 'Добавьте автомобиль в разделе «Мои автомобили»'}
            >
              <MenuItem value="">Primary по умолчанию</MenuItem>
              {(vehiclesQuery.data ?? []).map((vehicle) => (
                <MenuItem key={vehicle.id} value={vehicle.id}>
                  {vehicle.plate_number} {vehicle.is_primary ? '(primary)' : ''}
                </MenuItem>
              ))}
            </TextField>
          </FormSection>

          <FormSection title="2. Способ назначения места" subtitle="Выберите удобный сценарий бронирования." sx={{ p: { xs: 2.5, md: 3.25 } }}>
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
            <FormSection title="3. Выберите место" subtitle="Нажмите на строку в таблице, чтобы выбрать свободное место." sx={{ p: { xs: 2.5, md: 3.25 } }}>
              {availableSpotsQuery.error && <Alert severity="error">{getStatusErrorMessage(availableSpotsQuery.error as unknown as ApiError)}</Alert>}
              <AvailabilityTable items={availableSpotsQuery.data?.items ?? []} selectedSpotId={selectedSpotId} onSelect={setSelectedSpotId} />
            </FormSection>
          )}

          {mode === 'auto' && (
            <FormSection title="3. Параметры автоподбора" subtitle="Настройте ограничения и предпочтения перед запросом рекомендаций." sx={{ p: { xs: 2.5, md: 3.25 } }}>
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
                    {VEHICLE_TYPE_OPTIONS.map((option) => <MenuItem key={option} value={option}>{VEHICLE_TYPE_LABELS[option]}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    select
                    label="Зоны"
                    SelectProps={{ multiple: true }}
                    value={selectedZoneIds}
                    onChange={(event) => {
                      const next = event.target.value;
                      setSelectedZoneIds(
                        Array.isArray(next) ? next.map((item) => Number(item)).filter((item) => Number.isFinite(item)) : [],
                      );
                    }}
                    fullWidth
                    helperText="Можно выбрать несколько зон для автоподбора."
                  >
                    {zoneOptions.map((zone) => (
                      <MenuItem key={zone.id} value={zone.id}>{zone.name}</MenuItem>
                    ))}
                  </TextField>
                  {zoneOptionsQuery.isError && (
                    <Typography variant="caption" color="error">
                      Не удалось загрузить зоны, фильтр по зонам временно недоступен.
                    </Typography>
                  )}
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField select label="Размер места" value={sizeCategory} onChange={(event) => setSizeCategory(event.target.value as SizeCategory | '')} fullWidth>
                    <MenuItem value="">Любой</MenuItem>
                    {SIZE_CATEGORY_OPTIONS.map((option) => <MenuItem key={option} value={option}>{SIZE_CATEGORY_LABELS[option]}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Значимость факторов (вес)</Typography>
                </Grid>
                {([
                  ['availability', 'Доступность'],
                  ['spot_type', 'Тип места'],
                  ['zone', 'Зона'],
                  ['charger', 'Зарядка'],
                  ['role', 'Роль'],
                  ['conflict', 'Риск конфликта'],
                ] as const).map(([key, label]) => (
                  <Grid item xs={12} md={4} key={key}>
                    <Typography variant="body2" sx={{ mb: 0.75 }}>{label}: {(recommendationWeights[key] ?? 0).toFixed(2)}</Typography>
                    <Slider
                      min={0}
                      max={1}
                      step={0.05}
                      value={recommendationWeights[key] ?? 0}
                      onChange={(_, value) =>
                        setRecommendationWeights((prev) => ({
                          ...prev,
                          [key]: Number(Array.isArray(value) ? value[0] : value),
                        }))
                      }
                      valueLabelDisplay="auto"
                    />
                    <Typography variant="caption" color="text.secondary">0..1, итог нормализуется автоматически.</Typography>
                  </Grid>
                ))}
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
                    helperText="Это мягкое предпочтение, а не жёсткий фильтр."
                  >
                    {SPOT_TYPE_OPTIONS.map((option) => <MenuItem key={option} value={option}>{SPOT_TYPE_LABELS[option]}</MenuItem>)}
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
        </Stack>
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
