import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { LoadingState } from './loading-state';

interface PageStateProps {
  isLoading?: boolean;
  errorText?: string;
  emptyText?: string;
  isEmpty?: boolean;
}

export function PageState({ isLoading, errorText, emptyText, isEmpty }: PageStateProps) {
  if (isLoading) {
    return <LoadingState />;
  }

  if (errorText) {
    return <ErrorState message={errorText} />;
  }

  if (isEmpty && emptyText) {
    return <EmptyState title={emptyText} />;
  }

  return null;
}
