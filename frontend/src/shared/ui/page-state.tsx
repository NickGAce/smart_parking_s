import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { LoadingState } from './loading-state';

interface PageStateProps {
  isLoading?: boolean;
  errorText?: string;
  emptyText?: string;
  isEmpty?: boolean;
  emptyKind?: 'generic' | 'no-results' | 'not-found';
  onRetry?: () => void;
}

export function PageState({ isLoading, errorText, emptyText, isEmpty, emptyKind = 'generic', onRetry }: PageStateProps) {
  if (isLoading) {
    return <LoadingState variant="page" />;
  }

  if (errorText) {
    return <ErrorState message={errorText} onRetry={onRetry} />;
  }

  if (isEmpty) {
    return <EmptyState kind={emptyKind} title={emptyText} />;
  }

  return null;
}
