import { Box, Chip, LinearProgress, List, ListItem, ListItemText, Paper, Stack, Typography } from '@mui/material';

import type { DecisionReport } from '../../../shared/types/recommendation';

interface DecisionReportPanelProps {
  report: DecisionReport;
  title?: string;
}

const numberFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 4 });

function fmt(value: number) {
  return numberFormatter.format(value);
}

export function DecisionReportPanel({ report, title = 'Decision Report' }: DecisionReportPanelProps) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, overflow: 'hidden' }}>
      <Stack spacing={1.25}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
          <Chip size="small" color="primary" label={`Выбрано: ${report.selected_spot_label}`} />
          <Chip size="small" variant="outlined" label={`Score: ${fmt(report.final_score)}`} />
          <Chip size="small" variant="outlined" label={`Confidence: ${fmt(report.confidence * 100)}%`} />
        </Stack>

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Факторы решения</Typography>
          <List dense disablePadding>
            {report.factors.map((factor) => {
              const progressValue = Math.max(0, Math.min(100, Math.abs(factor.contribution) * 100));
              return (
                <ListItem key={`${factor.name}-${factor.explanation}`} disableGutters sx={{ display: 'block', py: 0.75 }}>
                  <ListItemText
                    primary={`${factor.name}: ${factor.explanation}`}
                    secondary={`raw=${fmt(factor.raw_value)}, weight=${fmt(factor.weight)}, contribution=${fmt(factor.contribution)}`}
                    primaryTypographyProps={{ sx: { overflowWrap: 'anywhere' } }}
                    secondaryTypographyProps={{ sx: { overflowWrap: 'anywhere' } }}
                  />
                  <LinearProgress variant="determinate" value={progressValue} sx={{ mt: 0.5, height: 8, borderRadius: 999 }} />
                </ListItem>
              );
            })}
          </List>
        </Box>

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 0.75 }}>Hard constraints</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {report.hard_constraints_passed.map((constraint) => (
              <Chip
                key={`${constraint.name}-${constraint.explanation}`}
                size="small"
                label={`${constraint.name}: ${constraint.explanation}`}
                color={constraint.passed ? 'success' : 'error'}
                variant={constraint.passed ? 'filled' : 'outlined'}
                sx={{ maxWidth: '100%' }}
              />
            ))}
          </Stack>
        </Box>

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Отклоненные кандидаты</Typography>
          {report.rejected_candidates.length === 0 ? (
            <Typography variant="body2" color="text.secondary">Нет отклоненных кандидатов для текущего окна.</Typography>
          ) : (
            <List dense disablePadding>
              {report.rejected_candidates.map((candidate) => (
                <ListItem key={`${candidate.spot_id}-${candidate.reason}`} disableGutters>
                  <ListItemText
                    primary={`Spot #${candidate.spot_id}: ${candidate.reason}`}
                    secondary={candidate.constraint ? `constraint=${candidate.constraint}` : 'constraint=—'}
                    primaryTypographyProps={{ sx: { overflowWrap: 'anywhere' } }}
                    secondaryTypographyProps={{ sx: { overflowWrap: 'anywhere' } }}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}
