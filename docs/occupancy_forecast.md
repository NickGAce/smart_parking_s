# Occupancy Forecast MVP (Explainable, non-ML)

## Goal
Predict expected parking occupancy by time buckets (hourly by default) using transparent statistical heuristics from historical bookings.

## Endpoint
`GET /api/v1/analytics/occupancy-forecast`

### Query params
- `parking_lot_id` *(optional)* — filter by parking lot.
- `zone` *(optional)* — filter by zone name.
- `target_date` *(optional)* — forecast full day (`00:00`–`24:00`), format `YYYY-MM-DD`.
- `from`, `to` *(optional pair)* — custom target time range.
- `history_days` *(default `56`)* — how much history to use.
- `bucket_size_hours` *(default `1`)* — bucket size.
- `moving_average_window` *(default `24`)* — smoothing window (0 disables SMA).

Use either `target_date` **or** `from`/`to`.

## Forecasting method
The service blends:
1. **Global historical average occupancy**
2. **Day-of-week average** (Mon, Tue, ...)
3. **Hour-of-day average** (00..23)
4. **Day-of-week + hour average** (e.g., Monday 09:00)
5. **Simple moving average** over recent buckets (optional smoothing)

The method is deterministic, explainable, and lightweight (no heavy ML libraries).

## Response structure
- `time_bucket` — bucket start datetime.
- `predicted_occupancy_percent` — prediction in `[0, 100]`.
- `confidence` — `high | medium | low` by sample count for weekday+hour pattern.
- `comment` — short explanation for confidence level.
- `samples` — number of exact weekday+hour historical samples.

## Example response
```json
{
  "parking_lot_id": 1,
  "zone": "A",
  "history_days": 56,
  "bucket_size_hours": 1,
  "target_from": "2026-01-02T00:00:00",
  "target_to": "2026-01-03T00:00:00",
  "forecast": [
    {
      "time_bucket": "2026-01-02T09:00:00",
      "predicted_occupancy_percent": 43.12,
      "confidence": "medium",
      "comment": "Moderate weekday+hour history.",
      "samples": 4
    }
  ]
}
```

## Extensibility for future ML
- Introduced `OccupancyForecastModel` protocol and `HistoricalPatternForecastModel` implementation.
- Future ML model can be added by implementing the same `predict(...)` contract and swapping model selection in service layer.

## Limitations
- No external signals (weather, events, holidays, roadworks).
- Sparse historical data leads to low-confidence estimates.
- Not designed for abrupt regime changes.
- Works best with regular booking patterns and enough history.
