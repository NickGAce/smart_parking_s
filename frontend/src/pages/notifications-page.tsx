import { Chip, List, ListItem, ListItemText, Paper, Typography } from '@mui/material';

import { useNotificationsQuery } from '../features/notifications/use-notifications-query';
import { PageState } from '../shared/ui/page-state';

export function NotificationsPage() {
  const { data, isLoading, error } = useNotificationsQuery();

  return (
    <>
      <Typography variant="h4" gutterBottom>Notifications</Typography>
      <PageState
        isLoading={isLoading}
        errorText={error ? 'Не удалось загрузить уведомления.' : undefined}
        isEmpty={!isLoading && !error && (data?.items.length ?? 0) === 0}
        emptyText="Уведомлений пока нет."
      />
      {data && data.items.length > 0 && (
        <Paper>
          <List>
            {data.items.map((item) => (
              <ListItem key={item.id} divider>
                <ListItemText
                  primary={item.title}
                  secondary={`${item.message} • ${new Date(item.created_at).toLocaleString()}`}
                />
                <Chip label={item.status} color={item.status === 'unread' ? 'primary' : 'default'} size="small" />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
    </>
  );
}
