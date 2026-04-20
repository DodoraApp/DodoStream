---
applyTo: 'src/components/**/*.tsx, src/app/**/*.tsx'
---

## Component Design

### Rules

- **Use `memo()`** for list items and frequently re-rendered components
- **Use `useCallback`** for event handlers passed to children
- **Use `useMemo`** only for genuinely expensive computations
- **Extract sub-components** - Keep components focused and under ~200 lines
- **Define TypeScript interfaces** for all component props

### Naming Conventions

- Use "Media" instead of "Movie" (supports various content types)
- Use `isFocused` for focus state (not `focused`)
- Use `handle*` for internal handlers, `on*` for callback props

### Reusable Components

Before creating a new component, check if one exists in:

- `src/components/basic/` — Button, Input, Tag, Badge, Focusable, ProgressBar, etc.
- `src/components/media/` — MediaCard, MediaList, EpisodeList, StreamList, etc.
- ... other domain-specific folders under `src/components/`

---

## LegendList

Use `@legendapp/list` (LegendList) for all scrollable lists:

```tsx
import { LegendList } from '@legendapp/list/react-native';

<LegendList
  data={items}
  renderItem={({ item }) => <ItemComponent item={item} />}
  keyExtractor={(item) => item.id}
  horizontal
/>;
```

### Key Points

- Use `keyExtractor` for proper recycling and layout caching
- Use `getFixedItemSize` when item sizes are known (skips measuring)
- Use `recycleItems` for lists where items have no local state
- Wrap `renderItem` in `useCallback` with correct deps
- For non-scrollable lists, use regular mapping instead
