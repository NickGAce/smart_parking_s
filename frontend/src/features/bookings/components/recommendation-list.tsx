import {
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';

import type { RecommendedSpot, RecommendationResult } from '../../../shared/types/recommendation';
import type { SpotType } from '../../../shared/types/common';

const spotTypeLabels: Record<SpotType, string> = {
  regular: 'Обычное',
  guest: 'Гостевое',
  disabled: 'Для МГН',
  ev: 'Электро',
  reserved: 'Служебное',
  vip: 'VIP',
};

interface RecommendationListProps {
  result: RecommendationResult;
  selectedSpotId?: number;
  onSelectSpot: (spotId: number) => void;
  onConfirmAuto: () => void;
  isSubmitting?: boolean;
}

function SpotCard({
  spot,
  selectedSpotId,
  onSelectSpot,
}: {
  spot: RecommendedSpot;
  selectedSpotId?: number;
  onSelectSpot: (spotId: number) => void;
}) {
  const isSelected = selectedSpotId === spot.spot_id;

  return (
    <Card variant={isSelected ? 'elevation' : 'outlined'} sx={{ borderColor: isSelected ? 'primary.main' : undefined }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle1">Место #{spot.spot_number}</Typography>
          <Chip label={`оценка: ${spot.score.toFixed(3)}`} color="primary" variant="outlined" />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          парковка #{spot.parking_lot_id} · зона {spot.zone_name ?? '—'} · {spotTypeLabels[spot.spot_type] ?? spot.spot_type} · зарядка: {spot.has_charger ? 'да' : 'нет'}
        </Typography>

        {spot.explainability.length > 0 && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="subtitle2" sx={{ mb: 0.75 }}>Почему эта рекомендация</Typography>
            <List dense disablePadding>
              {spot.explainability.map((factor, index) => (
                <ListItem key={`${factor.factor}-${index}`} disableGutters>
                  <ListItemText
                    primary={`${factor.factor}: ${factor.reason}`}
                    secondary={`значение=${factor.value}, вес=${factor.weight}, вклад=${factor.contribution}`}
                  />
                </ListItem>
              ))}
            </List>
          </>
        )}
      </CardContent>
      <CardActions>
        <Button size="small" variant={isSelected ? 'contained' : 'outlined'} onClick={() => onSelectSpot(spot.spot_id)}>
          {isSelected ? 'Выбрано' : 'Выбрать это место'}
        </Button>
      </CardActions>
    </Card>
  );
}

export function RecommendationList({ result, selectedSpotId, onSelectSpot, onConfirmAuto, isSubmitting }: RecommendationListProps) {
  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2" color="text.secondary">
        Кандидатов: {result.total_candidates}. Показано: {result.recommended_spots.length}.
      </Typography>
      <Button variant="contained" onClick={onConfirmAuto} disabled={isSubmitting}>
        Подтвердить автоподбор
      </Button>
      {result.recommended_spots.map((spot) => (
        <SpotCard key={spot.spot_id} spot={spot} selectedSpotId={selectedSpotId} onSelectSpot={onSelectSpot} />
      ))}
    </Stack>
  );
}
