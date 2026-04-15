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
            <TableCell>Charger</TableCell>
            <TableCell>Effective status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((spot) => (
            <TableRow
              key={spot.id}
              hover={spot.effective_status === 'available'}
              selected={selectedSpotId === spot.id}
              onClick={() => {
                if (spot.effective_status !== 'available') {
                  return;
                }
                onSelect(spot.id);
              }}
              sx={{
                cursor: spot.effective_status === 'available' ? 'pointer' : 'not-allowed',
                opacity: spot.effective_status === 'available' ? 1 : 0.6,
              }}
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
