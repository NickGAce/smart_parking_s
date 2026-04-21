import {
  Alert,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  Paper,
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

const factorLabels: Record<string, string> = {
  distance: 'Близость к целевой зоне',
  charger: 'Наличие зарядки',
  availability: 'Доступность в интервале',
  zone_match: 'Совпадение зоны',
  vehicle_type: 'Соответствие типу транспорта',
  size_category: 'Соответствие размеру',
};

function formatFactorLabel(factor: string) {
  return factorLabels[factor] ?? factor.replaceAll('_', ' ');
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
    <Card
      variant={isSelected ? 'elevation' : 'outlined'}
      sx={{
        borderColor: isSelected ? 'primary.main' : undefined,
        borderRadius: 2,
      }}
    >
      <CardContent>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={1.25} spacing={1}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Место #{spot.spot_number}
          </Typography>
          <Chip label={`Оценка подбора: ${spot.score.toFixed(3)}`} color="primary" variant="outlined" />
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip size="small" label={`Парковка #${spot.parking_lot_id}`} />
          <Chip size="small" label={`Зона: ${spot.zone_name ?? 'не указана'}`} />
          <Chip size="small" label={`Тип: ${spotTypeLabels[spot.spot_type] ?? spot.spot_type}`} />
          <Chip size="small" label={spot.has_charger ? 'С зарядкой' : 'Без зарядки'} />
        </Stack>

        {spot.explainability.length > 0 && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="subtitle2" sx={{ mb: 0.75 }}>Почему система рекомендует это место</Typography>
            <List dense disablePadding>
              {spot.explainability.map((factor, index) => (
                <ListItem key={`${factor.factor}-${index}`} disableGutters>
                  <ListItemText
                    primary={`${formatFactorLabel(factor.factor)}: ${factor.reason}`}
                    secondary={`Параметры: значение ${factor.value}, вес ${factor.weight}, вклад ${factor.contribution}`}
                    primaryTypographyProps={{ sx: { overflowWrap: 'anywhere' } }}
                    secondaryTypographyProps={{ sx: { overflowWrap: 'anywhere' } }}
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
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
        <Stack spacing={1}>
          <Typography variant="subtitle2">
            Подходящие места: {result.recommended_spots.length} из {result.total_candidates}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Выберите место из списка ниже, затем подтвердите создание бронирования.
          </Typography>
        </Stack>
      </Paper>
      {result.recommended_spots.length === 0 && (
        <Alert severity="warning">
          Рекомендации не найдены для выбранных параметров. Попробуйте ослабить фильтры (тип места, размер или обязательную зарядку).
        </Alert>
      )}
      <Button variant="contained" onClick={onConfirmAuto} disabled={isSubmitting}>
        Подтвердить выбранную рекомендацию
      </Button>
      {result.recommended_spots.map((spot) => (
        <SpotCard key={spot.spot_id} spot={spot} selectedSpotId={selectedSpotId} onSelectSpot={onSelectSpot} />
      ))}
    </Stack>
  );
}
