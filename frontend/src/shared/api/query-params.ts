export type PrimitiveParam = string | number | boolean | null | undefined;
export type QueryParams = Record<string, PrimitiveParam | PrimitiveParam[]>;

export const buildQueryParams = (params?: QueryParams): URLSearchParams => {
  const query = new URLSearchParams();

  if (!params) {
    return query;
  }

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry !== undefined && entry !== null && entry !== '') {
          query.append(key, String(entry));
        }
      });
      return;
    }

    query.set(key, String(value));
  });

  return query;
};
