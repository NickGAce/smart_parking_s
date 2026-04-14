import { useParams } from 'react-router-dom';

import { PagePlaceholder } from '../shared/ui/page-placeholder';

export function ParkingLotDetailsPage() {
  const { lotId } = useParams();

  return <PagePlaceholder description={`Parking lot details #${lotId}: metadata + rules editor will be added next.`} />;
}
