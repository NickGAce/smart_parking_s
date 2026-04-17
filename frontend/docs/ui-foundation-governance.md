# Smart Parking SPA — UI Foundation Governance

## 1) Цели foundation-слоя
- Зафиксировать единые дизайн-токены, чтобы новые экраны и рефакторинг старых шли через тему, а не через разрозненные `sx`.
- Снизить визуальную фрагментацию (цвета, тени, скругления, размеры текста) и упростить поддержку.
- Сохранить светлую тему как дефолтную и подготовить архитектуру к dark mode в будущем (через `getDesignTokens(mode)`).

## 2) Что добавлено в foundation

### Palette tokens
- Базовые шкалы: `blue`, `teal`, `green`, `amber`, `red`, `sky`, `slate`.
- Основные продуктовые роли:
  - `primary`
  - `secondary`
  - `success`
  - `warning`
  - `error`
  - `info`
  - `background`
  - `surface` (`page`, `raised`, `overlay`)
  - `border` (`subtle`, `strong`, `interactive`)
  - `textTone` (`strong`, `muted`)

### Typography scale (RU UI)
- `pageTitle`
- `sectionTitle`
- `cardTitle`
- `body1/body2`
- `caption`
- `button`
- `tableLabel`

Тон интерфейса: деловой, понятный, нейтральный (без перегруженного “маркетингового” контраста).

### Spacing strategy
- Базовый шаг: `theme.spacing(1) = 4px`.
- Рекомендуемые интервалы:
  - плотные контролы/чипы: `1..2`;
  - карточки/панели: `4..6`;
  - межсекционные отступы страницы: `6..8`.

### Radius, shadows, borders
- `theme.foundation.radius`: `xs/sm/md/lg/xl/pill`
- `theme.foundation.shadows`: `xs/sm/md/lg`
- `theme.foundation.borders`: `subtle/strong/focus`

### Focus + states
- `theme.foundation.focusRing` — стандартный фокус для интерактивных контролов.
- `theme.foundation.states` — `hover/active/disabledBg/disabledText`.

## 3) Component styling policy (MUI)
В теме стандартизированы стили для:
- `Button`
- `Card`
- `Paper`
- `Chip`
- `Alert`
- `TextField` (+ `OutlinedInput`)
- `Select`
- `Dialog`
- `Drawer`
- `Table` / `TableCell`
- `Tabs` / `Tab`
- `Tooltip`
- `Breadcrumbs`

Правило: сначала использовать theme-level стили и токены, и только потом локальный `sx` для действительно уникальных случаев.

## 4) База для постепенного выноса inline-паттернов
Добавлены семантические `sx`-шаблоны в `shared/theme/semantic-sx.ts`:
- `surfacePanelSx`
- `sectionHeaderSx`
- `tableCodeBlockSx`

Это стартовый слой для безопасной постепенной миграции повторяющихся `sx`, без массового risky-рефакторинга на текущем этапе.

## 5) Найденные проблемы текущего UI-слоя
1. Повторяющийся inline-паттерн `Paper sx={{ p: ... }}` на множестве экранов.
2. Локальные ad-hoc цвета (`grey.100`, warning background и т.п.) используются напрямую, мимо семантических ролей.
3. Табличные и служебные подписи частично живут на `body2`, нет единого table-label стандарта.
4. Состояния `hover/active/focus/disabled` централизованы не полностью (ранее были частично только в отдельных компонентах).
5. Нет formalized foundation-документа для команды (теперь добавлен).

## 6) Правила на следующие этапы
- Новые UI-фичи строить только через токены foundation.
- При затрагивании старых экранов: выносить только повторяемые стили в семантические шаблоны, без широкого рефакторинга всего файла.
- Если нужен новый цвет/размер/состояние — сначала добавить токен в тему и документировать, а затем применять в компонентах.
