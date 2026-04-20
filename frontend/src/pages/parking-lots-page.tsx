import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import RestartAltOutlinedIcon from '@mui/icons-material/RestartAltOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { useCurrentUser } from '../features/auth/use-current-user';
import { parkingApiErrorMessage } from '../features/parking-lots/error-messages';
import { useCreateParkingLotMutation, useParkingLotsQuery } from '../features/parking-lots/hooks';
import { ParkingLotForm } from '../features/parking-lots/parking-lot-form';
import { accessModeLabels } from '../shared/config/display-labels';
import { MANAGEMENT_ROLES, hasRole } from '../shared/config/roles';
import { ContentCard } from '../shared/ui/content-card';
import { EmptyState } from '../shared/ui/empty-state';
import { MetricCard } from '../shared/ui/metric-card';
import { PaginationControls } from '../shared/ui/pagination-controls';
import { DataListPageTemplate } from '../shared/ui/page-templates';
import { StatusChip } from '../shared/ui/status-chip';
import type { SortOrder } from '../shared/types/common';
import type { ParkingLotsQuery } from '../shared/types/parking';

const sortByOptions: NonNullable<ParkingLotsQuery['sort_by']>[] = ['id', 'name', 'total_spots'];
const sortByLabels: Record<(typeof sortByOptions)[number], string> = {
  id: 'Идентификатор',
  name: 'Название',
  total_spots: 'Количество мест',
};

export function ParkingLotsPage() {
  const { role } = useCurrentUser();
  const [query, setQuery] = useState<ParkingLotsQuery>({ limit: 10, offset: 0, sort_by: 'name', sort_order: 'asc' });
  const [createOpen, setCreateOpen] = useState(false);

  const canManage = hasRole(role, MANAGEMENT_ROLES);
  const lotsQuery = useParkingLotsQuery(query);
  const createMutation = useCreateParkingLotMutation();
  const totalLots = lotsQuery.data?.meta.total ?? 0;
  const totalSpots = lotsQuery.data?.items.reduce((sum, lot) => sum + lot.total_spots, 0) ?? 0;

  return (
    <>
      <DataListPageTemplate
        title="Каталог парковок"
        subtitle="Операционный список парковок с быстрым переходом в детали и редактирование."
        headerMeta={`Всего объектов: ${totalLots}`}
        headerActions={(
          <Button startIcon={<AddCircleOutlineIcon />} variant="contained" disabled={!canManage} onClick={() => setCreateOpen(true)}>
            Создать парковку
          </Button>
        )}
        topBanner={!canManage ? <Alert severity="info">Режим только чтение для вашей роли. Просмотр разрешен, управление отключено.</Alert> : null}
        kpiStrip={(
          <Grid container spacing={1.5}>
            <Grid item xs={12} md={6}>
              <MetricCard label="Парковок в каталоге" value={totalLots} helperText="С учетом пагинации и текущей сортировки." />
            </Grid>
            <Grid item xs={12} md={6}>
              <MetricCard label="Мест на текущей странице" value={totalSpots} helperText="Сумма total_spots для отображаемых парковок." />
            </Grid>
          </Grid>
        )}
        filters={(
          <ContentCard>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} gap={1.5}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Параметры списка</Typography>
                <Tooltip title="Вернуть сортировку по названию по возрастанию">
                  <span>
                    <Button
                      startIcon={<RestartAltOutlinedIcon />}
                      variant="outlined"
                      color="inherit"
                      onClick={() => setQuery((prev) => ({ ...prev, sort_by: 'name', sort_order: 'asc', offset: 0 }))}
                    >
                      Сбросить сортировку
                    </Button>
                  </span>
                </Tooltip>
              </Stack>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel id="sort-by-label">Сортировать по</InputLabel>
                  <Select
                    labelId="sort-by-label"
                    label="Сортировать по"
                    value={query.sort_by ?? 'name'}
                    onChange={(e) => setQuery((prev) => ({ ...prev, sort_by: e.target.value as ParkingLotsQuery['sort_by'], offset: 0 }))}
                  >
                    {sortByOptions.map((option) => (
                      <MenuItem key={option} value={option}>
                        {sortByLabels[option]}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel id="sort-order-label">Порядок</InputLabel>
                  <Select
                    labelId="sort-order-label"
                    label="Порядок"
                    value={query.sort_order ?? 'asc'}
                    onChange={(e) => setQuery((prev) => ({ ...prev, sort_order: e.target.value as SortOrder, offset: 0 }))}
                  >
                    <MenuItem value="asc">По возрастанию</MenuItem>
                    <MenuItem value="desc">По убыванию</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Stack>
          </ContentCard>
        )}
        isLoading={lotsQuery.isLoading}
        errorText={lotsQuery.isError ? parkingApiErrorMessage(lotsQuery.error, 'Не удалось загрузить список парковок.') : undefined}
        isEmpty={Boolean(lotsQuery.data && lotsQuery.data.items.length === 0)}
        emptyText="Парковки не найдены. Создайте первую парковку или измените параметры списка."
        dataView={lotsQuery.data && lotsQuery.data.items.length > 0 ? (
          <ContentCard padded={false} sx={{ borderRadius: (theme) => theme.foundation.radius.xs }}>
            <Box sx={{ p: { xs: 1.5, md: 2.5 }, overflowX: 'auto' }}>
              <Table sx={{ minWidth: 840 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Название</TableCell>
                    <TableCell>Адрес</TableCell>
                    <TableCell>Количество мест</TableCell>
                    <TableCell>Режим доступа</TableCell>
                    <TableCell align="right">Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lotsQuery.data.items.map((lot) => (
                    <TableRow key={lot.id} hover>
                      <TableCell>{lot.id}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{lot.name}</Typography>
                      </TableCell>
                      <TableCell>{lot.address}</TableCell>
                      <TableCell>{lot.total_spots}</TableCell>
                      <TableCell>
                        <StatusChip
                          status={lot.access_mode}
                          mapping={{ [lot.access_mode]: { label: accessModeLabels[lot.access_mode], color: 'default' } }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button component={RouterLink} to={`/parking-lots/${lot.id}`} startIcon={<VisibilityOutlinedIcon />} size="small">
                          Открыть
                        </Button>
                        <Button
                          component={RouterLink}
                          to={`/parking-lots/${lot.id}?mode=edit`}
                          startIcon={<EditOutlinedIcon />}
                          size="small"
                          disabled={!canManage}
                        >
                          Редактировать
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            <PaginationControls
              count={lotsQuery.data.meta.total}
              page={Math.floor(lotsQuery.data.meta.offset / lotsQuery.data.meta.limit)}
              rowsPerPage={lotsQuery.data.meta.limit}
              onPageChange={(page) => setQuery((prev) => ({ ...prev, offset: page * (prev.limit ?? 10) }))}
              onRowsPerPageChange={(rowsPerPage) => setQuery((prev) => ({ ...prev, limit: rowsPerPage, offset: 0 }))}
            />
          </ContentCard>
        ) : <EmptyState title="Парковки не найдены" description="Создайте первую парковку или измените параметры списка." />}
      />

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Создание парковки</DialogTitle>
        <DialogContent>
          <Box mt={1}>
            <ParkingLotForm
              title="Новая парковка"
              submitLabel="Создать"
              disabled={createMutation.isPending}
              readOnly={!canManage}
              serverError={createMutation.isError ? parkingApiErrorMessage(createMutation.error, 'Не удалось создать парковку.') : null}
              onSubmit={(payload) => createMutation.mutate(payload, { onSuccess: () => setCreateOpen(false) })}
            />
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
}
