import { Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { StatusChip } from '../../../shared/ui/status-chip';
import type { ParkingSpot } from '../../../shared/types/parking';

const effectiveStatusMap: Record<string, { label: string; color: 'default' | 'success' | 'warning' | 'error' | 'info' }> = {
  available: { label: 'Доступно', color: 'success' },
  booked: { label: 'Занято', color: 'warning' },
  blocked: { label: 'Заблокировано', color: 'error' },
};

interface AvailabilityTableProps {
  items: ParkingSpot[];
  selectedSpotId?: number;
  onSelect: (spotId: number) => void;
}

export function AvailabilityTable({ items, selectedSpotId, onSelect }: AvailabilityTableProps) {
  if (items.length === 0) {
    return <Typography color="text.secondary">Нет мест, подходящих под выбранный интервал и лот.</Typography>;
  }

  return (
    <Paper variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Место</TableCell>
            <TableCell>Тип</TableCell>
            <TableCell>Зона</TableCell>
            <TableCell>Зарядка</TableCell>
            <TableCell>Доступность</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((spot) => (
            <TableRow
              key={spot.id}
              hover
              selected={selectedSpotId === spot.id}
              onClick={() => onSelect(spot.id)}
              sx={{ cursor: 'pointer' }}
            >
              <TableCell>{spot.id}</TableCell>
              <TableCell>{spot.spot_number}</TableCell>
              <TableCell>{spot.spot_type}</TableCell>
              <TableCell>{spot.zone_name ?? '—'}</TableCell>
              <TableCell>{spot.has_charger ? 'Да' : 'Нет'}</TableCell>
              <TableCell>
                <StatusChip status={spot.effective_status} mapping={effectiveStatusMap} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}
