import {
  Alert,
  Box,
  Button,
  Drawer,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';

import { useCurrentUser } from '../../auth/use-current-user';
import { bookingApiErrorMessage } from '../error-messages';
import { useBookingQuery, useCancelBookingMutation, useUpdateBookingMutation } from '../hooks';
import { bookingStatuses } from '../constants';
import { canCancelBooking, canChangeStatus as canChangeStatusAction, canEditBooking } from '../../../shared/config/booking-actions';
import { bookingStatusMap } from '../../../shared/config/status-map';
import { StatusChip } from '../../../shared/ui/status-chip';
import type { BookingStatus } from '../../../shared/types/common';
import type { BookingType, UpdateBookingPayload } from '../../../shared/types/booking';

interface Props {
  bookingId: number | null;
  onClose: () => void;
}

const bookingTypeOptions: BookingType[] = ['guest', 'employee'];

const asInputDateTime = (value: string) => value.slice(0, 16);

export function BookingDetailsPanel({ bookingId, onClose }: Props) {
  const { role } = useCurrentUser();
  const detailsQuery = useBookingQuery(bookingId ?? 0);
  const updateMutation = useUpdateBookingMutation(bookingId ?? 0);
  const cancelMutation = useCancelBookingMutation(bookingId ?? 0);

  const booking = detailsQuery.data;

  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [bookingType, setBookingType] = useState<BookingType>('employee');
  const [nextStatus, setNextStatus] = useState<BookingStatus>('pending');

  useEffect(() => {
    if (!booking) {
      return;
    }

    setStartTime(asInputDateTime(booking.start_time));
    setEndTime(asInputDateTime(booking.end_time));
    setBookingType(booking.type);
    setNextStatus(booking.status);
  }, [booking]);

  const updatePayload: UpdateBookingPayload = {
    start_time: startTime ? new Date(startTime).toISOString() : undefined,
    end_time: endTime ? new Date(endTime).toISOString() : undefined,
    type: bookingType,
    status: nextStatus,
  };

  const canEdit = booking ? canEditBooking(booking.status, role) : false;
  const canChangeStatus = booking ? canChangeStatusAction(booking.status, role) : false;
  const canCancel = booking ? canCancelBooking(booking.status, role) : false;

  return (
    <Drawer anchor="right" open={bookingId !== null} onClose={onClose}>
      <Box sx={{ width: 460, p: 2 }}>
        <Stack spacing={2}>
          <Typography variant="h6">Booking details / operations</Typography>

          <Alert severity="info">
            UI скрывает явно недоступные действия, но backend остаётся источником истины для transition rules.
          </Alert>

          <Alert severity="warning">DELETE выполняет soft cancel: запись сохраняется, статус переходит в cancelled, если переход разрешён backend.</Alert>

          {detailsQuery.isError && <Alert severity="error">{bookingApiErrorMessage(detailsQuery.error, 'Не удалось загрузить детали бронирования.')}</Alert>}

          {booking && (
            <Stack spacing={1.5}>
              <Typography><b>ID:</b> {booking.id}</Typography>
              <Typography><b>Interval:</b> {new Date(booking.start_time).toLocaleString()} — {new Date(booking.end_time).toLocaleString()}</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography><b>Status:</b></Typography>
                <StatusChip status={booking.status} mapping={bookingStatusMap} />
              </Stack>
              <Typography><b>Parking info:</b> spot #{booking.parking_spot_id}</Typography>
              <Typography><b>Assignment mode:</b> {booking.assignment_mode}</Typography>
              <Typography><b>Assignment metadata:</b> {booking.assignment_metadata ? JSON.stringify(booking.assignment_metadata) : '—'}</Typography>
              <Typography><b>Explanation:</b> {booking.assignment_explanation ?? '—'}</Typography>

              <TextField label="start_time" type="datetime-local" InputLabelProps={{ shrink: true }} value={startTime} onChange={(e) => setStartTime(e.target.value)} disabled={!canEdit || updateMutation.isPending} />
              <TextField label="end_time" type="datetime-local" InputLabelProps={{ shrink: true }} value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={!canEdit || updateMutation.isPending} />

              <FormControl size="small" disabled={!canEdit || updateMutation.isPending}>
                <InputLabel id="booking-type">type</InputLabel>
                <Select labelId="booking-type" label="type" value={bookingType} onChange={(e) => setBookingType(e.target.value as BookingType)}>
                  {bookingTypeOptions.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
                </Select>
              </FormControl>

              <FormControl size="small" disabled={!canChangeStatus || updateMutation.isPending}>
                <InputLabel id="booking-status">status</InputLabel>
                <Select labelId="booking-status" label="status" value={nextStatus} onChange={(e) => setNextStatus(e.target.value as BookingStatus)}>
                  {bookingStatuses.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
                </Select>
              </FormControl>

              {(updateMutation.isError || cancelMutation.isError) && (
                <Alert severity="error">
                  {bookingApiErrorMessage(updateMutation.error ?? cancelMutation.error, 'Переход статуса отклонен backend или данные невалидны.')}
                </Alert>
              )}

              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  disabled={updateMutation.isPending || (!canEdit && !canChangeStatus)}
                  onClick={() => updateMutation.mutate(updatePayload)}
                >
                  PATCH /bookings/{booking.id}
                </Button>
                <Button color="error" variant="outlined" disabled={!canCancel || cancelMutation.isPending} onClick={() => cancelMutation.mutate()}>
                  DELETE /bookings/{booking.id}
                </Button>
              </Stack>
            </Stack>
          )}
        </Stack>
      </Box>
    </Drawer>
  );
}
