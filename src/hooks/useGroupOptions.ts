import { useMemo } from 'react';
import { TagOption } from '@/components/basic/TagFilters';
import { PickerItem } from '@/components/basic/PickerModal';

export interface UseGroupOptionsParams<T extends string | number> {
  items: PickerItem<T>[];
  getItemGroupId?: (item: PickerItem<T>) => string | null;
  getGroupLabel?: (groupId: string) => string;
  preferredGroupIds?: string[];
}

export const useGroupOptions = <T extends string | number>({
  items,
  getItemGroupId,
  getGroupLabel,
  preferredGroupIds,
}: UseGroupOptionsParams<T>): TagOption[] => {
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      const id = getItemGroupId?.(item) ?? item.groupId ?? null;
      if (id) {
        const label = getGroupLabel?.(id) ?? id;
        map.set(id, label);
      }
    }
    const arr: TagOption[] = Array.from(map.entries()).map(([id, label]) => ({ id, label }));

    if (preferredGroupIds && preferredGroupIds.length > 0) {
      arr.sort((a, b) => {
        const ai = preferredGroupIds.indexOf(a.id);
        const bi = preferredGroupIds.indexOf(b.id);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return a.label.localeCompare(b.label);
      });
    } else {
      arr.sort((a, b) => a.label.localeCompare(b.label));
    }

    return arr;
  }, [items, getItemGroupId, getGroupLabel, preferredGroupIds]);
};
