import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
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
import { ApiErrorAlert } from '../shared/ui/api-error-alert';
import { ConfirmDialog } from '../shared/ui/confirm-dialog';
import { FiltersToolbar } from '../shared/ui/filters-toolbar';
import { LoadingState } from '../shared/ui/loading-state';
import { PaginationControls } from '../shared/ui/pagination-controls';
import { StatusChip } from '../shared/ui/status-chip';
import type { SortOrder } from '../shared/types/common';
import type { ParkingSpot, ParkingSpotsQuery } from '../shared/types/parking';

const DEFAULT_LIMIT = 10;

type ParkingSpotsSortBy = NonNullable<ParkingSpotsQuery['sort_by']>;

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

export function ParkingSpotsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useCurrentUser();

  const query = useMemo(() => parseQuery(searchParams), [searchParams]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingSpot, setEditingSpot] = useState<ParkingSpot | null>(null);
  const [deletingSpot, setDeletingSpot] = useState<ParkingSpot | null>(null);
  const [drawerSpotId, setDrawerSpotId] = useState<number | null>(null);

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

  return (
    <Stack spacing={2}>
      <Alert severity="info">
        <b>UX-пояснение:</b> <code>effective_status</code> — вычисляемый статус для выбранного интервала from/to (учёт блокировки и активных пересечений бронирования).{' '}
        <code>status</code> — базовый (raw) статус spot в модели.
      </Alert>

      {!canManage && (
        <Alert severity="info">Роль с read-only доступом: можно просматривать каталог и детали, но CRUD для parking spots отключен.</Alert>
      )}

      <FiltersToolbar>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}><TextField label="from" type="datetime-local" fullWidth size="small" value={query.from ?? ''} InputLabelProps={{ shrink: true }} onChange={(e) => applyQuery({ from: e.target.value || undefined }, true)} /></Grid>
          <Grid item xs={12} md={3}><TextField label="to" type="datetime-local" fullWidth size="small" value={query.to ?? ''} InputLabelProps={{ shrink: true }} onChange={(e) => applyQuery({ to: e.target.value || undefined }, true)} /></Grid>

          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="spot-type-filter">spot_type</InputLabel>
              <Select labelId="spot-type-filter" label="spot_type" value={query.spot_type ?? ''} onChange={(e) => applyQuery({ spot_type: (e.target.value as ParkingSpotsQuery['spot_type']) || undefined }, true)}>
                <MenuItem value="">all</MenuItem>
                {parkingSpotTypeOptions.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="vehicle-type-filter">vehicle_type</InputLabel>
              <Select labelId="vehicle-type-filter" label="vehicle_type" value={query.vehicle_type ?? ''} onChange={(e) => applyQuery({ vehicle_type: (e.target.value as ParkingSpotsQuery['vehicle_type']) || undefined }, true)}>
                <MenuItem value="">all</MenuItem>
                {parkingSpotVehicleTypeOptions.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="size-filter">size_category</InputLabel>
              <Select labelId="size-filter" label="size_category" value={query.size_category ?? ''} onChange={(e) => applyQuery({ size_category: (e.target.value as ParkingSpotsQuery['size_category']) || undefined }, true)}>
                <MenuItem value="">all</MenuItem>
                {parkingSpotSizeCategoryOptions.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="charger-filter">has_charger</InputLabel>
              <Select
                labelId="charger-filter"
                label="has_charger"
                value={query.has_charger === undefined ? '' : String(query.has_charger)}
                onChange={(e) => applyQuery({ has_charger: parseBooleanParam(e.target.value || null) }, true)}
              >
                <MenuItem value="">all</MenuItem>
                <MenuItem value="true">true</MenuItem>
                <MenuItem value="false">false</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}><TextField label="zone_id" type="number" size="small" fullWidth value={query.zone_id ?? ''} onChange={(e) => applyQuery({ zone_id: e.target.value ? Number(e.target.value) : undefined }, true)} /></Grid>
          <Grid item xs={12} md={2}><TextField label="zone_name" size="small" fullWidth value={query.zone_name ?? ''} onChange={(e) => applyQuery({ zone_name: e.target.value || undefined }, true)} /></Grid>
          <Grid item xs={12} md={2}><TextField label="parking_lot_id" type="number" size="small" fullWidth value={query.parking_lot_id ?? ''} onChange={(e) => applyQuery({ parking_lot_id: e.target.value ? Number(e.target.value) : undefined }, true)} /></Grid>

          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="status-filter">status</InputLabel>
              <Select labelId="status-filter" label="status" value={query.status ?? ''} onChange={(e) => applyQuery({ status: (e.target.value as ParkingSpotsQuery['status']) || undefined }, true)}>
                <MenuItem value="">all</MenuItem>
                {parkingSpotRawStatusOptions.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="sort-by">sort_by</InputLabel>
              <Select labelId="sort-by" label="sort_by" value={query.sort_by ?? 'id'} onChange={(e) => applyQuery({ sort_by: e.target.value as ParkingSpotsSortBy }, true)}>
                {parkingSpotSortByOptions.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="sort-order">sort_order</InputLabel>
              <Select labelId="sort-order" label="sort_order" value={query.sort_order ?? 'asc'} onChange={(e) => applyQuery({ sort_order: e.target.value as SortOrder }, true)}>
                {parkingSpotSortOrderOptions.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={2}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => {
                setSearchParams(writeQuery({ limit: query.limit ?? DEFAULT_LIMIT, offset: 0, sort_by: 'id', sort_order: 'asc' }));
              }}
            >
              Сбросить фильтры
            </Button>
          </Grid>

          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" startIcon={<AddCircleOutlineIcon />} disabled={!canManage} onClick={() => setCreateOpen(true)}>
              Создать spot
            </Button>
          </Grid>
        </Grid>
      </FiltersToolbar>

      {listQuery.isError && <ApiErrorAlert message={parkingApiErrorMessage(listQuery.error, 'Не удалось загрузить parking spots.')} />}
      {listQuery.isLoading && <LoadingState message="Загрузка parking spots..." />}
      {(createMutation.isSuccess || updateMutation.isSuccess || deleteMutation.isSuccess) && (
        <Alert severity="success">Изменения успешно сохранены.</Alert>
      )}
      {listQuery.data && listQuery.data.items.length === 0 && (
        <Paper sx={{ p: 4 }}>
          <Typography variant="h6">Места не найдены</Typography>
          <Typography color="text.secondary">
            Для выбранных фильтров список пуст. Сбросьте фильтры или создайте новое место.
          </Typography>
        </Paper>
      )}

      {listQuery.data && listQuery.data.items.length > 0 && (
        <Paper>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Spot number</TableCell>
                <TableCell>spot_type</TableCell>
                <TableCell>effective_status</TableCell>
                <TableCell>raw status</TableCell>
                <TableCell>Parking lot / zone</TableCell>
                <TableCell>Charger / size / vehicle</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {listQuery.data.items.map((spot) => (
                <TableRow key={spot.id} hover>
                  <TableCell>{spot.spot_number}</TableCell>
                  <TableCell>{spotTypeValue(spot)}</TableCell>
                  <TableCell><StatusChip status={spot.effective_status} mapping={effectiveStatusMap} /></TableCell>
                  <TableCell>{parkingSpotRawStatusLabels[spot.status]}</TableCell>
                  <TableCell>Lot #{spot.parking_lot_id} / {spot.zone_name ? `${spot.zone_name} (${spot.zone_id ?? 'n/a'})` : (spot.zone_id ?? 'No zone')}</TableCell>
                  <TableCell>{spot.has_charger ? 'charger' : 'no charger'} / {spot.size_category} / {spot.vehicle_type}</TableCell>
                  <TableCell align="right">
                    <Button size="small" startIcon={<VisibilityOutlinedIcon />} onClick={() => setDrawerSpotId(spot.id)}>Details</Button>
                    <Button size="small" startIcon={<EditOutlinedIcon />} disabled={!canManage} onClick={() => setEditingSpot(spot)}>Edit</Button>
                    <Button color="error" size="small" startIcon={<DeleteOutlineIcon />} disabled={!canManage} onClick={() => setDeletingSpot(spot)}>Delete</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationControls
            count={listQuery.data.meta.total}
            page={Math.floor(listQuery.data.meta.offset / listQuery.data.meta.limit)}
            rowsPerPage={listQuery.data.meta.limit}
            onPageChange={(page) => applyQuery({ offset: page * (query.limit ?? DEFAULT_LIMIT) })}
            onRowsPerPageChange={(rowsPerPage) => applyQuery({ limit: rowsPerPage, offset: 0 })}
          />
        </Paper>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Создание parking spot</DialogTitle>
        <DialogContent>
          <Box mt={1}>
            <ParkingSpotForm
              mode="create"
              disabled={createMutation.isPending}
              readOnly={!canManage}
              serverError={createMutation.isError ? parkingApiErrorMessage(createMutation.error, 'Не удалось создать spot.') : null}
              onSubmit={(payload) => createMutation.mutate(payload as never, { onSuccess: () => setCreateOpen(false) })}
            />
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingSpot)} onClose={() => setEditingSpot(null)} maxWidth="md" fullWidth>
        <DialogTitle>Редактирование parking spot</DialogTitle>
        <DialogContent>
          {editingSpot && (
            <Box mt={1}>
              <ParkingSpotForm
                mode="edit"
                initial={editingSpot}
                disabled={updateMutation.isPending}
                readOnly={!canManage}
                serverError={updateMutation.isError ? parkingApiErrorMessage(updateMutation.error, 'Не удалось обновить spot.') : null}
                onSubmit={(payload) => updateMutation.mutate(payload as never, { onSuccess: () => setEditingSpot(null) })}
              />
            </Box>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deletingSpot)}
        title="Удалить parking spot?"
        description={`Вы действительно хотите удалить spot #${deletingSpot?.spot_number} (ID ${deletingSpot?.id})? Это действие нельзя отменить.`}
        danger
        pending={deleteMutation.isPending}
        confirmLabel="Удалить"
        onCancel={() => setDeletingSpot(null)}
        onConfirm={() => {
          if (!deletingSpot) {
            return;
          }
          deleteMutation.mutate(deletingSpot.id, { onSuccess: () => setDeletingSpot(null) });
        }}
      />

      <Drawer anchor="right" open={drawerSpotId !== null} onClose={() => setDrawerSpotId(null)}>
        <Box sx={{ width: 420, p: 2 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>Parking spot details</Typography>
          {detailsQuery.isLoading && <LoadingState message="Loading..." />}
          {detailsQuery.isError && <ApiErrorAlert message={parkingApiErrorMessage(detailsQuery.error, 'Не удалось загрузить детали spot.')} />}
          {detailsQuery.data && (
            <Stack spacing={1}>
              <Typography><b>ID:</b> {detailsQuery.data.id}</Typography>
              <Typography><b>Spot number:</b> {detailsQuery.data.spot_number}</Typography>
              <Typography><b>spot_type:</b> {spotTypeValue(detailsQuery.data)}</Typography>
              <Typography><b>effective_status:</b> {detailsQuery.data.effective_status}</Typography>
              <Typography><b>raw status:</b> {detailsQuery.data.status}</Typography>
              <Typography><b>Parking lot:</b> {detailsQuery.data.parking_lot_id}</Typography>
              <Typography><b>Zone:</b> {detailsQuery.data.zone_name ?? detailsQuery.data.zone_id ?? 'No zone'}</Typography>
              <Typography><b>Vehicle type:</b> {detailsQuery.data.vehicle_type}</Typography>
              <Typography><b>Size:</b> {detailsQuery.data.size_category}</Typography>
              <Typography><b>Charger:</b> {detailsQuery.data.has_charger ? 'yes' : 'no'}</Typography>
            </Stack>
          )}
        </Box>
      </Drawer>
    </Stack>
  );
}
