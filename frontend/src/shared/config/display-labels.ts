import type { AccessMode } from '../types/parking';
import type { UserRole } from '../types/common';

export const userRoleLabels: Record<UserRole, string> = {
  admin: 'Администратор',
  owner: 'Владелец парковки',
  tenant: 'Сотрудник',
  guard: 'Охрана',
  uk: 'Управляющая компания',
};

export const accessModeLabels: Record<AccessMode, string> = {
  employees_only: 'Только сотрудники',
  guests_only: 'Только гости',
  mixed: 'Смешанный режим',
};
