import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import MoreVertOutlinedIcon from '@mui/icons-material/MoreVertOutlined';
import RestartAltOutlinedIcon from '@mui/icons-material/RestartAltOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogContent,
  Drawer,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  Menu,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { memo, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useCurrentUser } from '../features/auth/use-current-user';
import { parkingApiErrorMessage } from '../features/parking-lots/error-messages';
import {
  parkingSpotRawStatusLabels,
  parkingSpotRawStatusOptions,
  parkingSpotSizeCategoryOptions,
  parkingSpotSortByOptions,
  parkingSpotSortOrderOptions,
  parkingSpotTypeOptions,
  parkingSpotVehicleTypeOptions,
} from '../features/parking-spots/constants';
import {
  useCreateParkingSpotMutation,
  useDeleteParkingSpotMutation,
  useParkingSpotQuery,
  useParkingSpotsQuery,
  useUpdateParkingSpotMutation,
} from '../features/parking-spots/hooks';
import { ParkingSpotForm } from '../features/parking-spots/parking-spot-form';
import { effectiveStatusMap } from '../shared/config/status-map';
import { MANAGEMENT_ROLES, hasRole } from '../shared/config/roles';
import { DestructiveConfirmDialog } from '../shared/ui/destructive-confirm-dialog';
import { DialogHeader } from '../shared/ui/dialog-header';
import { ContentCard } from '../shared/ui/content-card';
import { DataListPageTemplate } from '../shared/ui/page-templates';
import { MetricCard } from '../shared/ui/metric-card';
import { PaginationControls } from '../shared/ui/pagination-controls';
import { StatusChip } from '../shared/ui/status-chip';
import type { SortOrder, SpotRawStatus, SpotType, VehicleType } from '../shared/types/common';
import type { ParkingSpot, ParkingSpotsQuery } from '../shared/types/parking';

const DEFAULT_LIMIT = 10;

type ParkingSpotsSortBy = NonNullable<ParkingSpotsQuery['sort_by']>;

type FiltersDraft = Omit<ParkingSpotsQuery, 'limit' | 'offset'>;

const spotTypeLabels: Record<SpotType, string> = {
  regular: 'Обычное',
  guest: 'Гостевое',
  disabled: 'Для МГН',
  ev: 'Электро',
  reserved: 'Зарезервированное',
  vip: 'VIP',
};

const vehicleTypeLabels: Record<VehicleType, string> = {
  car: 'Автомобиль',
  bike: 'Мото/вело',
  truck: 'Грузовой',
};

const sizeLabels: Record<NonNullable<ParkingSpotsQuery['size_category']>, string> = {
  small: 'Малый',
  medium: 'Средний',
  large: 'Большой',
};

const sortByLabels: Record<ParkingSpotsSortBy, string> = {
  id: 'ID',
  spot_number: 'Номер места',
  status: 'Базовый статус',
  spot_type: 'Тип места',
  vehicle_type: 'Тип транспорта',
  size_category: 'Размер места',
};

const sortOrderLabels: Record<SortOrder, string> = {
  asc: 'По возрастанию',
  desc: 'По убыванию',
};

const parseEnumParam = <T extends string>(value: string | null, allowedValues: readonly T[]): T | undefined => {
  if (!value) {
    return undefined;
  }

  return allowedValues.includes(value as T) ? (value as T) : undefined;
};

const parseNumberParam = (value: string | null): number | undefined => {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseBooleanParam = (value: string | null): boolean | undefined => {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return undefined;
};

function parseQuery(searchParams: URLSearchParams): ParkingSpotsQuery {
  return {
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
    spot_type: parseEnumParam(searchParams.get('spot_type'), parkingSpotTypeOptions),
    vehicle_type: parseEnumParam(searchParams.get('vehicle_type'), parkingSpotVehicleTypeOptions),
    size_category: parseEnumParam(searchParams.get('size_category'), parkingSpotSizeCategoryOptions),
    has_charger: parseBooleanParam(searchParams.get('has_charger')),
    zone_id: parseNumberParam(searchParams.get('zone_id')),
    zone_name: searchParams.get('zone_name') ?? undefined,
    parking_lot_id: parseNumberParam(searchParams.get('parking_lot_id')),
    status: parseEnumParam(searchParams.get('status'), parkingSpotRawStatusOptions),
    limit: parseNumberParam(searchParams.get('limit')) ?? DEFAULT_LIMIT,
    offset: parseNumberParam(searchParams.get('offset')) ?? 0,
    sort_by: parseEnumParam(searchParams.get('sort_by'), parkingSpotSortByOptions) ?? 'id',
    sort_order: parseEnumParam(searchParams.get('sort_order'), parkingSpotSortOrderOptions) ?? 'asc',
  };
}

function writeQuery(params: ParkingSpotsQuery): Record<string, string> {
  const next: Record<string, string> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    next[key] = String(value);
  });
  return next;
}

const spotTypeValue = (spot: ParkingSpot) => spot.spot_type ?? (spot.type as ParkingSpot['spot_type']) ?? 'regular';

function toDraft(query: ParkingSpotsQuery): FiltersDraft {
  return {
    from: query.from,
    to: query.to,
    spot_type: query.spot_type,
    vehicle_type: query.vehicle_type,
    size_category: query.size_category,
    has_charger: query.has_charger,
    zone_id: query.zone_id,
    zone_name: query.zone_name,
    parking_lot_id: query.parking_lot_id,
    status: query.status,
    sort_by: query.sort_by,
    sort_order: query.sort_order,
  };
}

const stickyHeadCellSx = { bgcolor: 'action.hover', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2 };
const stickyFirstColumnSx = { position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1 };

interface ParkingSpotRowProps {
  spot: ParkingSpot;
  onOpenDetails: (spotId: number) => void;
  onOpenActionsMenu: (event: MouseEvent<HTMLElement>, spotId: number) => void;
}

const ParkingSpotRow = memo(function ParkingSpotRow({ spot, onOpenDetails, onOpenActionsMenu }: ParkingSpotRowProps) {
  return (
    <TableRow hover>
      <TableCell sx={stickyFirstColumnSx}>
        <Stack spacing={0.25}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>#{spot.spot_number}</Typography>
          <Typography variant="caption" color="text.secondary">ID {spot.id}</Typography>
        </Stack>
      </TableCell>
      <TableCell>{spotTypeLabels[spotTypeValue(spot)]}</TableCell>
      <TableCell><StatusChip status={spot.effective_status} mapping={effectiveStatusMap} /></TableCell>
      <TableCell>{parkingSpotRawStatusLabels[spot.status]}</TableCell>
      <TableCell>
        <Stack spacing={0.25}>
          <Typography variant="body2">Парковка #{spot.parking_lot_id}</Typography>
          <Typography variant="caption" color="text.secondary">{spot.zone_name ? `${spot.zone_name} (ID ${spot.zone_id ?? '—'})` : (spot.zone_id ? `Зона ID ${spot.zone_id}` : 'Без зоны')}</Typography>
        </Stack>
      </TableCell>
      <TableCell>
        <Typography variant="body2">
          {spot.has_charger ? 'С зарядкой' : 'Без зарядки'} · {sizeLabels[spot.size_category]} · {vehicleTypeLabels[spot.vehicle_type]}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
          <Button size="small" variant="contained" startIcon={<VisibilityOutlinedIcon />} onClick={() => onOpenDetails(spot.id)}>
            Детали
          </Button>
          <Tooltip title="Дополнительные действия">
            <span>
              <IconButton size="small" onClick={(event) => onOpenActionsMenu(event, spot.id)}>
                <MoreVertOutlinedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </TableCell>
    </TableRow>
  );
});

export function ParkingSpotsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useCurrentUser();

  const query = useMemo(() => parseQuery(searchParams), [searchParams]);
  const [draft, setDraft] = useState<FiltersDraft>(() => toDraft(query));

  useEffect(() => {
    setDraft(toDraft(query));
  }, [query]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingSpot, setEditingSpot] = useState<ParkingSpot | null>(null);
  const [deletingSpot, setDeletingSpot] = useState<ParkingSpot | null>(null);
  const [drawerSpotId, setDrawerSpotId] = useState<number | null>(null);
  const [actionsAnchor, setActionsAnchor] = useState<HTMLElement | null>(null);
  const [actionsSpotId, setActionsSpotId] = useState<number | null>(null);

  const canManage = hasRole(role, MANAGEMENT_ROLES);

  const listQuery = useParkingSpotsQuery(query);
  const detailsQuery = useParkingSpotQuery(drawerSpotId ?? 0);
  const createMutation = useCreateParkingSpotMutation();
  const updateMutation = useUpdateParkingSpotMutation(editingSpot?.id ?? 0);
  const deleteMutation = useDeleteParkingSpotMutation();

  const applyQuery = (patch: Partial<ParkingSpotsQuery>, resetOffset = false) => {
    const nextQuery: ParkingSpotsQuery = {
      ...query,
      ...patch,
      offset: resetOffset ? 0 : (patch.offset ?? query.offset ?? 0),
    };
    setSearchParams(writeQuery(nextQuery));
  };

  const handleApplyFilters = () => {
    applyQuery({ ...draft }, true);
  };

  const handleResetFilters = () => {
    const resetQuery: ParkingSpotsQuery = { limit: query.limit ?? DEFAULT_LIMIT, offset: 0, sort_by: 'id', sort_order: 'asc' };
    setDraft(toDraft(resetQuery));
    setSearchParams(writeQuery(resetQuery));
  };

  const totalSpots = listQuery.data?.meta.total ?? 0;
  const availableOnPage = listQuery.data?.items.filter((spot) => spot.effective_status === 'available').length ?? 0;
  const withChargerOnPage = listQuery.data?.items.filter((spot) => spot.has_charger).length ?? 0;
  const hasActiveFilters = Boolean(
    query.from
    || query.to
    || query.spot_type
    || query.vehicle_type
    || query.size_category
    || query.has_charger !== undefined
    || query.zone_id !== undefined
    || query.zone_name
    || query.parking_lot_id !== undefined
    || query.status,
  );
  const selectedSpot = listQuery.data?.items.find((spot) => spot.id === actionsSpotId);

  const openActionsMenu = (event: MouseEvent<HTMLElement>, spotId: number) => {
    setActionsAnchor(event.currentTarget);
    setActionsSpotId(spotId);
  };

  const closeActionsMenu = () => {
    setActionsAnchor(null);
    setActionsSpotId(null);
  };

  return (
    <>
      <DataListPageTemplate
        title="Управление парковочными местами"
        subtitle="Операционный реестр мест с интервалами доступности, статусами и быстрыми действиями."
        headerMeta={`Записей в каталоге: ${totalSpots}`}
        headerActions={(
          <Button variant="contained" startIcon={<AddCircleOutlineIcon />} disabled={!canManage} onClick={() => setCreateOpen(true)}>
            Добавить место
          </Button>
        )}
        topBanner={(
          <Stack spacing={1.5}>
            <Alert icon={<InfoOutlinedIcon />} severity="info">
              <b>Подсказка по статусам:</b> «Текущий статус» учитывает интервал <code>from/to</code> и активные бронирования, а «Базовый статус» — исходное состояние места в модели.
            </Alert>
            {!canManage ? (
              <Alert severity="info">Для вашей роли доступен только просмотр: редактирование и удаление мест отключены.</Alert>
            ) : null}
            {(createMutation.isSuccess || updateMutation.isSuccess || deleteMutation.isSuccess) ? (
              <Alert severity="success">Изменения сохранены.</Alert>
            ) : null}
          </Stack>
        )}
        kpiStrip={(
          <Grid container spacing={1.5}>
            <Grid item xs={12} md={4}>
              <MetricCard label="Всего мест" value={totalSpots} helperText="С учетом пагинации и фильтров." align="center" />
            </Grid>
            <Grid item xs={12} md={4}>
              <MetricCard label="Свободно на странице" value={availableOnPage} helperText="Быстрый срез по текущему интервалу." align="center" />
            </Grid>
            <Grid item xs={12} md={4}>
              <MetricCard label="С зарядкой на странице" value={withChargerOnPage} helperText="Количество мест с EV-зарядкой." align="center" />
            </Grid>
          </Grid>
        )}
        filters={(
          <ContentCard>
            <Stack spacing={2.5}>
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} gap={1.5}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Фильтры и сортировка
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} width={{ xs: '100%', sm: 'auto' }}>
                  <Button variant="outlined" color="inherit" startIcon={<RestartAltOutlinedIcon />} onClick={handleResetFilters} fullWidth={false}>
                    Сбросить
                  </Button>
                  <Button variant="contained" onClick={handleApplyFilters}>
                    Применить
                  </Button>
                </Stack>
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <StatusChip
                  status={hasActiveFilters ? 'filtered' : 'default'}
                  mapping={{
                    filtered: { label: 'Фильтры активны', color: 'info' },
                    default: { label: 'Без дополнительных фильтров', color: 'default' },
                  }}
                  variant="outlined"
                />
                <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                  Сначала примените фильтры, затем работайте со строковыми действиями.
                </Typography>
              </Stack>

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="tableLabel" color="text.secondary">Интервал и локация</Typography>
                </Grid>
                <Grid item xs={12} md={3}><TextField label="Начало интервала" type="datetime-local" fullWidth size="small" value={draft.from ?? ''} InputLabelProps={{ shrink: true }} onChange={(e) => setDraft((prev) => ({ ...prev, from: e.target.value || undefined }))} /></Grid>
                <Grid item xs={12} md={3}><TextField label="Конец интервала" type="datetime-local" fullWidth size="small" value={draft.to ?? ''} InputLabelProps={{ shrink: true }} onChange={(e) => setDraft((prev) => ({ ...prev, to: e.target.value || undefined }))} /></Grid>
                <Grid item xs={12} md={2}><TextField label="ID парковки" type="number" size="small" fullWidth value={draft.parking_lot_id ?? ''} onChange={(e) => setDraft((prev) => ({ ...prev, parking_lot_id: e.target.value ? Number(e.target.value) : undefined }))} /></Grid>
                <Grid item xs={12} md={2}><TextField label="ID зоны" type="number" size="small" fullWidth value={draft.zone_id ?? ''} onChange={(e) => setDraft((prev) => ({ ...prev, zone_id: e.target.value ? Number(e.target.value) : undefined }))} /></Grid>
                <Grid item xs={12} md={2}><TextField label="Название зоны" size="small" fullWidth value={draft.zone_name ?? ''} onChange={(e) => setDraft((prev) => ({ ...prev, zone_name: e.target.value || undefined }))} /></Grid>

                <Grid item xs={12} sx={{ pt: 0.5 }}>
                  <Typography variant="tableLabel" color="text.secondary">Типы и статусы</Typography>
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="spot-type-filter">Тип места</InputLabel>
                    <Select labelId="spot-type-filter" label="Тип места" value={draft.spot_type ?? ''} onChange={(e) => setDraft((prev) => ({ ...prev, spot_type: (e.target.value as ParkingSpotsQuery['spot_type']) || undefined }))}>
                      <MenuItem value="">Все</MenuItem>
                      {parkingSpotTypeOptions.map((value) => <MenuItem key={value} value={value}>{spotTypeLabels[value]}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="vehicle-type-filter">Тип транспорта</InputLabel>
                    <Select labelId="vehicle-type-filter" label="Тип транспорта" value={draft.vehicle_type ?? ''} onChange={(e) => setDraft((prev) => ({ ...prev, vehicle_type: (e.target.value as ParkingSpotsQuery['vehicle_type']) || undefined }))}>
                      <MenuItem value="">Все</MenuItem>
                      {parkingSpotVehicleTypeOptions.map((value) => <MenuItem key={value} value={value}>{vehicleTypeLabels[value]}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="size-filter">Размер</InputLabel>
                    <Select labelId="size-filter" label="Размер" value={draft.size_category ?? ''} onChange={(e) => setDraft((prev) => ({ ...prev, size_category: (e.target.value as ParkingSpotsQuery['size_category']) || undefined }))}>
                      <MenuItem value="">Все</MenuItem>
                      {parkingSpotSizeCategoryOptions.map((value) => <MenuItem key={value} value={value}>{sizeLabels[value]}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="charger-filter">Зарядка</InputLabel>
                    <Select
                      labelId="charger-filter"
                      label="Зарядка"
                      value={draft.has_charger === undefined ? '' : String(draft.has_charger)}
                      onChange={(e) => setDraft((prev) => ({ ...prev, has_charger: parseBooleanParam(e.target.value || null) }))}
                    >
                      <MenuItem value="">Все</MenuItem>
                      <MenuItem value="true">Есть</MenuItem>
                      <MenuItem value="false">Нет</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="status-filter">Базовый статус</InputLabel>
                    <Select labelId="status-filter" label="Базовый статус" value={draft.status ?? ''} onChange={(e) => setDraft((prev) => ({ ...prev, status: (e.target.value as SpotRawStatus) || undefined }))}>
                      <MenuItem value="">Все</MenuItem>
                      {parkingSpotRawStatusOptions.map((value) => <MenuItem key={value} value={value}>{parkingSpotRawStatusLabels[value]}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sx={{ pt: 0.5 }}>
                  <Typography variant="tableLabel" color="text.secondary">Сортировка</Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="sort-by">Поле сортировки</InputLabel>
                    <Select labelId="sort-by" label="Поле сортировки" value={draft.sort_by ?? 'id'} onChange={(e) => setDraft((prev) => ({ ...prev, sort_by: e.target.value as ParkingSpotsSortBy }))}>
                      {parkingSpotSortByOptions.map((value) => <MenuItem key={value} value={value}>{sortByLabels[value]}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="sort-order">Порядок</InputLabel>
                    <Select labelId="sort-order" label="Порядок" value={draft.sort_order ?? 'asc'} onChange={(e) => setDraft((prev) => ({ ...prev, sort_order: e.target.value as SortOrder }))}>
                      {parkingSpotSortOrderOptions.map((value) => <MenuItem key={value} value={value}>{sortOrderLabels[value]}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Stack>
          </ContentCard>
        )}
        isLoading={listQuery.isLoading}
        errorText={listQuery.isError ? parkingApiErrorMessage(listQuery.error, 'Не удалось загрузить список мест.') : undefined}
        isEmpty={Boolean(listQuery.data && listQuery.data.items.length === 0)}
        emptyText={hasActiveFilters ? 'По выбранным фильтрам места не найдены. Измените параметры или сбросьте фильтры.' : 'Список мест пуст. Добавьте первое парковочное место.'}
        dataView={listQuery.data && listQuery.data.items.length > 0 ? (
          <ContentCard padded={false} sx={{ borderRadius: (theme) => theme.foundation.radius.xs }}>
            <Box sx={{ overflowX: 'auto', p: { xs: 1.5, md: 2.5 } }}>
              <Table size="medium" sx={{ minWidth: 980 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ ...stickyHeadCellSx, ...stickyFirstColumnSx, zIndex: 3 }}>Место</TableCell>
                    <TableCell sx={stickyHeadCellSx}>Тип</TableCell>
                    <TableCell sx={stickyHeadCellSx}>Текущий статус</TableCell>
                    <TableCell sx={stickyHeadCellSx}>Базовый статус</TableCell>
                    <TableCell sx={stickyHeadCellSx}>Парковка и зона</TableCell>
                    <TableCell sx={stickyHeadCellSx}>Параметры</TableCell>
                    <TableCell align="right" sx={stickyHeadCellSx}>Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {listQuery.data.items.map((spot) => (
                    <ParkingSpotRow key={spot.id} spot={spot} onOpenDetails={setDrawerSpotId} onOpenActionsMenu={openActionsMenu} />
                  ))}
                </TableBody>
              </Table>
            </Box>
            <PaginationControls
              count={listQuery.data.meta.total}
              page={Math.floor(listQuery.data.meta.offset / listQuery.data.meta.limit)}
              rowsPerPage={listQuery.data.meta.limit}
              onPageChange={(page) => applyQuery({ offset: page * (query.limit ?? DEFAULT_LIMIT) })}
              onRowsPerPageChange={(rowsPerPage) => applyQuery({ limit: rowsPerPage, offset: 0 })}
            />
          </ContentCard>
        ) : undefined}
      />

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="md" fullWidth>
        <DialogHeader title="Добавление парковочного места" subtitle="Заполните параметры места. Обязательные поля отмечены звездочкой." />
        <DialogContent sx={{ pt: 1.5 }}>
          <Box>
            <ParkingSpotForm
              mode="create"
              disabled={createMutation.isPending}
              readOnly={!canManage}
              serverError={createMutation.isError ? parkingApiErrorMessage(createMutation.error, 'Не удалось создать место.') : null}
              onSubmit={(payload) => createMutation.mutate(payload as never, { onSuccess: () => setCreateOpen(false) })}
            />
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingSpot)} onClose={() => setEditingSpot(null)} maxWidth="md" fullWidth>
        <DialogHeader title="Редактирование парковочного места" subtitle="Проверьте изменения перед сохранением." />
        <DialogContent sx={{ pt: 1.5 }}>
          {editingSpot && (
            <Box>
              <ParkingSpotForm
                mode="edit"
                initial={editingSpot}
                disabled={updateMutation.isPending}
                readOnly={!canManage}
                serverError={updateMutation.isError ? parkingApiErrorMessage(updateMutation.error, 'Не удалось обновить место.') : null}
                onSubmit={(payload) => updateMutation.mutate(payload as never, { onSuccess: () => setEditingSpot(null) })}
              />
            </Box>
          )}
        </DialogContent>
      </Dialog>

      <DestructiveConfirmDialog
        open={Boolean(deletingSpot)}
        title="Удалить парковочное место"
        description={`Вы уверены, что хотите удалить место №${deletingSpot?.spot_number} (ID ${deletingSpot?.id})?`}
        pending={deleteMutation.isPending}
        confirmLabel="Удалить место"
        onCancel={() => setDeletingSpot(null)}
        onConfirm={() => {
          if (!deletingSpot) {
            return;
          }
          deleteMutation.mutate(deletingSpot.id, { onSuccess: () => setDeletingSpot(null) });
        }}
      />

      <Drawer anchor="right" open={drawerSpotId !== null} onClose={() => setDrawerSpotId(null)}>
        <Box sx={{ width: { xs: 340, md: 420 }, p: 2.5 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>Карточка парковочного места</Typography>
          {detailsQuery.isLoading ? <Typography color="text.secondary">Загрузка...</Typography> : null}
          {detailsQuery.isError ? <Alert severity="error">{parkingApiErrorMessage(detailsQuery.error, 'Не удалось загрузить детали места.')}</Alert> : null}
          {detailsQuery.data ? (
            <Stack spacing={1.25}>
              <Typography><b>ID:</b> {detailsQuery.data.id}</Typography>
              <Typography><b>Номер места:</b> {detailsQuery.data.spot_number}</Typography>
              <Typography><b>Тип:</b> {spotTypeLabels[spotTypeValue(detailsQuery.data)]}</Typography>
              <Typography><b>Текущий статус:</b> {effectiveStatusMap[detailsQuery.data.effective_status]?.label ?? detailsQuery.data.effective_status}</Typography>
              <Typography><b>Базовый статус:</b> {parkingSpotRawStatusLabels[detailsQuery.data.status]}</Typography>
              <Typography><b>Парковка:</b> {detailsQuery.data.parking_lot_id}</Typography>
              <Typography><b>Зона:</b> {detailsQuery.data.zone_name ?? detailsQuery.data.zone_id ?? 'Не указана'}</Typography>
              <Typography><b>Тип транспорта:</b> {vehicleTypeLabels[detailsQuery.data.vehicle_type]}</Typography>
              <Typography><b>Размер:</b> {sizeLabels[detailsQuery.data.size_category]}</Typography>
              <Typography><b>Зарядка:</b> {detailsQuery.data.has_charger ? 'Есть' : 'Нет'}</Typography>
            </Stack>
          ) : null}
        </Box>
      </Drawer>
      <Menu
        anchorEl={actionsAnchor}
        open={Boolean(actionsAnchor)}
        onClose={closeActionsMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          disabled={!selectedSpot || !canManage}
          onClick={() => {
            if (selectedSpot) setEditingSpot(selectedSpot);
            closeActionsMenu();
          }}
        >
          <EditOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
          Редактировать
        </MenuItem>
        <MenuItem
          disabled={!selectedSpot || !canManage}
          onClick={() => {
            if (selectedSpot) setDeletingSpot(selectedSpot);
            closeActionsMenu();
          }}
          sx={{ color: 'error.main' }}
        >
          <DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} />
          Удалить
        </MenuItem>
      </Menu>
    </>
  );
}
