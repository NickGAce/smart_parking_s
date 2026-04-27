import {
  Alert,
  Box,
  Button,
  IconButton,
  Divider,
  Drawer,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useEffect, useState } from 'react';

import { useCurrentUser } from '../../auth/use-current-user';
import { bookingStatuses } from '../constants';
import { bookingApiErrorMessage, bookingLifecycleErrorMessage } from '../error-messages';
import {
  useBookingQuery,
  useCancelBookingMutation,
  useCheckInBookingMutation,
  useCheckOutBookingMutation,
  useMarkNoShowBookingMutation,
  useUpdateBookingMutation,
} from '../hooks';
import {
  bookingAssignmentModeLabelMap,
  bookingStatusLabelMap,
  bookingTypeLabelMap,
  formatBookingDurationLabel,
  formatBookingInterval,
} from '../../../shared/config/booking-ui';
import {
  bookingActionAvailabilityMap,
  canCancelBooking,
  canChangeStatus as canChangeStatusAction,
  canEditBooking,
  getAvailableBookingActions,
} from '../../../shared/config/booking-actions';
import { bookingStatusMap } from '../../../shared/config/status-map';
import { DateTimeField } from '../../../shared/ui/date-time-field';
import { KeyValueList } from '../../../shared/ui/key-value-list';
import { StatusChip } from '../../../shared/ui/status-chip';
import type { BookingStatus } from '../../../shared/types/common';
import type { BookingType, UpdateBookingPayload } from '../../../shared/types/booking';
import { DecisionReportPanel } from './decision-report-panel';

interface Props {
  bookingId: number | null;
  onClose: () => void;
}

const bookingTypeOptions: BookingType[] = ['guest', 'rental'];
const bookingActionLabels: Record<string, string> = {
  open_details: 'Открыть детали',
  edit: 'Редактировать',
  change_status: 'Изменить статус',
  cancel: 'Отменить',
};

const asInputDateTime = (value: string) => value.slice(0, 16);

export function BookingDetailsPanel({ bookingId, onClose }: Props) {
  const { role } = useCurrentUser();
  const detailsQuery = useBookingQuery(bookingId ?? 0, { refetchIntervalMs: 15_000 });
  const updateMutation = useUpdateBookingMutation(bookingId ?? 0);
  const cancelMutation = useCancelBookingMutation(bookingId ?? 0);
  const checkInMutation = useCheckInBookingMutation();
  const checkOutMutation = useCheckOutBookingMutation();
  const markNoShowMutation = useMarkNoShowBookingMutation();

  const booking = detailsQuery.data;

  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [bookingType, setBookingType] = useState<BookingType>('rental');
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
  const canCheckIn = Boolean(booking && ['confirmed', 'active'].includes(booking.status));
  const canCheckOut = Boolean(booking && booking.status === 'active');
  const canMarkNoShow = Boolean(booking && ['confirmed', 'active'].includes(booking.status));
  const availableActions = booking ? getAvailableBookingActions(booking.status, role) : [];
  const isLifecyclePending = checkInMutation.isPending || checkOutMutation.isPending || markNoShowMutation.isPending;
  const lifecycleError = checkInMutation.error ?? checkOutMutation.error ?? markNoShowMutation.error;
  const hasEditableChanges = Boolean(
    booking && (
      booking.start_time !== (startTime ? new Date(startTime).toISOString() : booking.start_time)
      || booking.end_time !== (endTime ? new Date(endTime).toISOString() : booking.end_time)
      || booking.type !== bookingType
      || booking.status !== nextStatus
    ),
  );
  const titleId = 'booking-details-title';
  const descriptionId = 'booking-details-description';

  return (
    <Drawer
      anchor="right"
      open={bookingId !== null}
      onClose={onClose}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      ModalProps={{ keepMounted: true }}
      sx={{
        zIndex: (theme) => theme.zIndex.appBar + 2,
        '& .MuiDrawer-paper': {
          top: { xs: 64, md: 72 },
          height: { xs: 'calc(100% - 64px)', md: 'calc(100% - 72px)' },
        },
      }}
    >
      <Box sx={{ width: { xs: 360, md: 520 }, p: { xs: 2, md: 2.5 } }}>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
            <Box>
              <Typography id={titleId} variant="h6">Детали бронирования</Typography>
              <Typography id={descriptionId} variant="body2" color="text.secondary">
                Здесь можно проверить интервал, статус и доступные действия, а также отредактировать бронирование, если это разрешено ролью.
              </Typography>
            </Box>
            <IconButton onClick={onClose} aria-label="Закрыть панель деталей бронирования">
              <CloseRoundedIcon />
            </IconButton>
          </Stack>

          {detailsQuery.isError && <Alert severity="error">{bookingApiErrorMessage(detailsQuery.error, 'Не удалось загрузить детали бронирования.')}</Alert>}

          {booking && (
            <Stack spacing={2}>
              <KeyValueList
                items={[
                  { key: 'ID', value: `#${booking.id}` },
                  { key: 'Интервал', value: formatBookingInterval(booking.start_time, booking.end_time) },
                  { key: 'Длительность', value: formatBookingDurationLabel(booking.start_time, booking.end_time) },
                  { key: 'Пользователь', value: booking.user_id },
                  { key: 'Парковочное место', value: `#${booking.parking_spot_id}` },
                  { key: 'Тип бронирования', value: bookingTypeLabelMap[booking.type] },
                  { key: 'Режим назначения', value: bookingAssignmentModeLabelMap[booking.assignment_mode] ?? booking.assignment_mode },
                  { key: 'Пояснение назначения', value: booking.assignment_explanation ?? '—' },
                ]}
              />
              {booking.decision_report && <DecisionReportPanel report={booking.decision_report} title="Отчёт по решению для бронирования" />}
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary">Статус:</Typography>
                <StatusChip status={booking.status} mapping={bookingStatusMap} />
              </Stack>

              <Alert severity="info">Доступные действия для текущей роли: {availableActions.map((action) => bookingActionLabels[action] ?? action).join(', ') || 'нет'}.</Alert>
              <Alert severity="info">Допустимые действия для статуса «{bookingStatusLabelMap[booking.status]}»: {bookingActionAvailabilityMap[booking.status].map((action) => bookingActionLabels[action] ?? action).join(', ')}.</Alert>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button variant="contained" color="success" disabled={!canCheckIn || isLifecyclePending} onClick={() => booking && checkInMutation.mutate(booking.id)}>
                  Прибытие
                </Button>
                <Button variant="contained" color="primary" disabled={!canCheckOut || isLifecyclePending} onClick={() => booking && checkOutMutation.mutate(booking.id)}>
                  Выезд
                </Button>
                <Button variant="outlined" color="warning" disabled={!canMarkNoShow || isLifecyclePending} onClick={() => booking && markNoShowMutation.mutate(booking.id)}>
                  Неявка
                </Button>
              </Stack>

              {lifecycleError && (
                <Alert severity="error">
                  {bookingLifecycleErrorMessage(lifecycleError, 'Операция не выполнена. Проверьте актуальный статус и повторите попытку.')}
                </Alert>
              )}

              <Divider />

              <Typography variant="subtitle2">Редактирование</Typography>
              <DateTimeField
                label="Время начала"
                value={startTime}
                onChange={setStartTime}
                helperText="Изменяйте время только если уверены, что интервал свободен."
                disabled={!canEdit || updateMutation.isPending}
              />
              <DateTimeField
                label="Время окончания"
                value={endTime}
                onChange={setEndTime}
                disabled={!canEdit || updateMutation.isPending}
              />

              <FormControl size="small" disabled={!canEdit || updateMutation.isPending}>
                <InputLabel id="booking-type">Тип бронирования</InputLabel>
                <Select labelId="booking-type" label="Тип бронирования" value={bookingType} onChange={(e) => setBookingType(e.target.value as BookingType)}>
                  {bookingTypeOptions.map((option) => <MenuItem key={option} value={option}>{bookingTypeLabelMap[option]}</MenuItem>)}
                </Select>
              </FormControl>

              <FormControl size="small" disabled={!canChangeStatus || updateMutation.isPending}>
                <InputLabel id="booking-status">Новый статус</InputLabel>
                <Select labelId="booking-status" label="Новый статус" value={nextStatus} onChange={(e) => setNextStatus(e.target.value as BookingStatus)}>
                  {bookingStatuses.map((option) => <MenuItem key={option} value={option}>{bookingStatusLabelMap[option]}</MenuItem>)}
                </Select>
              </FormControl>

              {(updateMutation.isError || cancelMutation.isError) && (
                <Alert severity="error">
                  {bookingApiErrorMessage(updateMutation.error ?? cancelMutation.error, 'Не удалось применить изменения. Проверьте данные и попробуйте снова.')}
                </Alert>
              )}

              <Stack direction="row" spacing={1.5}>
                <Button
                  variant="contained"
                  disabled={updateMutation.isPending || (!canEdit && !canChangeStatus) || !hasEditableChanges}
                  onClick={() => updateMutation.mutate(updatePayload)}
                >
                  Сохранить изменения
                </Button>
                <Button color="error" variant="outlined" disabled={!canCancel || cancelMutation.isPending} onClick={() => cancelMutation.mutate()}>
                  Отменить бронирование
                </Button>
              </Stack>
            </Stack>
          )}
        </Stack>
      </Box>
    </Drawer>
  );
}
