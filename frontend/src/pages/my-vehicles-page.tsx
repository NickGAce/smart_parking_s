import { Alert, Button, Chip, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';

import {
  useCreateVehicleMutation,
  useDeleteVehicleMutation,
  useUpdateVehicleMutation,
  useVehiclesQuery,
} from '../features/vehicles/hooks';
import type { VehicleType } from '../shared/types/vehicle';
import { DataListPageTemplate } from '../shared/ui/page-templates';
import { DataPanel } from '../shared/ui/data-panel';

const vehicleTypes: VehicleType[] = ['car', 'ev', 'truck', 'bike', 'van'];

const vehicleTypeLabels: Record<VehicleType, string> = {
  car: 'Легковой',
  ev: 'Электромобиль',
  truck: 'Грузовой',
  bike: 'Мото/вело',
  van: 'Фургон',
};

export function MyVehiclesPage() {
  const vehiclesQuery = useVehiclesQuery();
  const createMutation = useCreateVehicleMutation();
  const updateMutation = useUpdateVehicleMutation();
  const deleteMutation = useDeleteVehicleMutation();

  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('car');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');

  const submit = async () => {
    if (!plateNumber.trim()) return;
    await createMutation.mutateAsync({
      plate_number: plateNumber,
      vehicle_type: vehicleType,
      brand: brand || undefined,
      model: model || undefined,
      color: color || undefined,
      is_primary: vehiclesQuery.data?.length === 0,
    });
    setPlateNumber('');
    setBrand('');
    setModel('');
    setColor('');
  };

  return (
    <DataListPageTemplate
      title="Мои автомобили"
      subtitle="Управление автомобилями для интеллектуального распознавания и автопривязки к бронированиям."
      dataView={(
        <Stack spacing={2}>
          <DataPanel title="Добавить автомобиль" subtitle="После добавления номер будет использоваться в ANPR и бронированиях.">
            <Grid container spacing={1.5}>
              <Grid item xs={12} md={3}>
                <TextField label="Номер" value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} fullWidth />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField select label="Тип" value={vehicleType} onChange={(e) => setVehicleType(e.target.value as VehicleType)} fullWidth>
                  {vehicleTypes.map((type) => (
                    <MenuItem key={type} value={type}>{vehicleTypeLabels[type]}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={2}><TextField label="Бренд" value={brand} onChange={(e) => setBrand(e.target.value)} fullWidth /></Grid>
              <Grid item xs={12} md={2}><TextField label="Модель" value={model} onChange={(e) => setModel(e.target.value)} fullWidth /></Grid>
              <Grid item xs={12} md={2}><TextField label="Цвет" value={color} onChange={(e) => setColor(e.target.value)} fullWidth /></Grid>
              <Grid item xs={12} md={1}><Button variant="contained" fullWidth sx={{ height: '100%' }} onClick={submit}>+</Button></Grid>
            </Grid>
          </DataPanel>

          <DataPanel title="Список автомобилей">
            <Stack spacing={1}>
              {(vehiclesQuery.data ?? []).map((vehicle) => (
                <Stack key={vehicle.id} direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between" sx={{ border: '1px solid', borderColor: 'border.subtle', borderRadius: 2, p: 1.25 }}>
                  <Stack spacing={0.5}>
                    <Typography fontWeight={700}>{vehicle.plate_number}</Typography>
                    <Typography variant="caption" color="text.secondary">{vehicleTypeLabels[vehicle.vehicle_type]} · {vehicle.brand ?? '—'} {vehicle.model ?? ''}</Typography>
                    <Stack direction="row" spacing={1}>
                      {vehicle.is_primary ? <Chip size="small" label="основной" color="success" /> : null}
                      <Chip size="small" label={vehicle.is_active ? 'активен' : 'неактивен'} variant="outlined" />
                    </Stack>
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" variant="outlined" onClick={() => updateMutation.mutate({ id: vehicle.id, payload: { is_primary: true } })}>Сделать основным</Button>
                    <Button size="small" color="error" variant="outlined" onClick={() => deleteMutation.mutate(vehicle.id)}>Удалить</Button>
                  </Stack>
                </Stack>
              ))}
            </Stack>
            {!vehiclesQuery.data?.length ? <Alert severity="info">Автомобили еще не добавлены.</Alert> : null}
          </DataPanel>
        </Stack>
      )}
    />
  );
}
