import { TablePagination } from '@mui/material';
import type { ChangeEvent } from 'react';

interface PaginationControlsProps {
  count: number;
  page: number;
  rowsPerPage: number;
  rowsPerPageOptions?: number[];
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
}

export function PaginationControls({
  count,
  page,
  rowsPerPage,
  rowsPerPageOptions = [5, 10, 20, 50],
  onPageChange,
  onRowsPerPageChange,
}: PaginationControlsProps) {
  return (
    <TablePagination
      component="div"
      count={count}
      page={page}
      rowsPerPage={rowsPerPage}
      onPageChange={(_, nextPage) => onPageChange(nextPage)}
      onRowsPerPageChange={(event: ChangeEvent<HTMLInputElement>) => {
        onRowsPerPageChange(Number(event.target.value));
      }}
      rowsPerPageOptions={rowsPerPageOptions}
    />
  );
}
