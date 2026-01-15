import { FC, memo, useCallback, useMemo } from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import { Box, Text } from '@/theme/theme';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsSwitch } from '@/components/settings/SettingsSwitch';
import { OrderableListSection, OrderableItem } from '@/components/settings/OrderableListSection';
import { HeroCatalogSource, useHomeStore } from '@/store/home.store';
import { useAddonStore } from '@/store/addon.store';
import { SliderInput } from '@/components/basic/SliderInput';
import { HERO_CONTENT_REFRESH_MS } from '@/constants/ui';

/** Catalog item for the orderable list */
interface CatalogOrderableItem extends OrderableItem {
  addonId: string;
  catalogId: string;
  catalogType: string;
}

export interface HomeSettingsContentProps {
  /** Whether to wrap content in ScrollView (default: true) */
  scrollable?: boolean;
}

/**
 * Home settings content component
 * Allows customizing the home screen hero section per profile
 */
export const HomeSettingsContent: FC<HomeSettingsContentProps> = memo(({ scrollable = true }) => {
  const {
    heroEnabled,
    heroItemCount,
    heroCatalogSources,
    setHeroEnabled,
    setHeroItemCount,
    setHeroCatalogSources,
  } = useHomeStore((state) => ({
    heroEnabled: state.getActiveSettings().heroEnabled,
    heroItemCount: state.getActiveSettings().heroItemCount,
    heroCatalogSources: state.getActiveSettings().heroCatalogSources,
    setHeroEnabled: state.setHeroEnabled,
    setHeroItemCount: state.setHeroItemCount,
    setHeroCatalogSources: state.setHeroCatalogSources,
  }));

  const addons = useAddonStore((state) => state.addons);

  // Build a lookup for addon names
  const addonNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    Object.values(addons).forEach((addon) => {
      map[addon.id] = addon.manifest.name;
    });
    return map;
  }, [addons]);

  // Build a lookup for catalog names from addons
  const catalogNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    Object.values(addons).forEach((addon) => {
      const catalogs = addon.manifest.catalogs ?? [];
      catalogs.forEach((catalog) => {
        const key = `${addon.id}-${catalog.type}-${catalog.id}`;
        map[key] = catalog.name ?? catalog.id;
      });
    });
    return map;
  }, [addons]);

  // Convert hero catalog sources to orderable items
  const selectedCatalogs = useMemo<CatalogOrderableItem[]>(() => {
    return heroCatalogSources.map((source) => {
      const key = `${source.addonId}-${source.catalogType}-${source.catalogId}`;
      return {
        id: key,
        label: catalogNameMap[key] ?? source.catalogId,
        secondaryLabel: `${addonNameMap[source.addonId] ?? source.addonId} • ${source.catalogType}`,
        addonId: source.addonId,
        catalogId: source.catalogId,
        catalogType: source.catalogType,
      };
    });
  }, [heroCatalogSources, addonNameMap, catalogNameMap]);

  // Build available catalogs from installed addons (not already selected)
  const availableCatalogs = useMemo<CatalogOrderableItem[]>(() => {
    const selectedKeys = new Set(
      heroCatalogSources.map((s) => `${s.addonId}-${s.catalogType}-${s.catalogId}`)
    );

    const available: CatalogOrderableItem[] = [];
    Object.values(addons)
      .filter((addon) => addon.useCatalogsOnHome)
      .forEach((addon) => {
        const catalogs = addon.manifest.catalogs ?? [];
        catalogs.forEach((catalog) => {
          const key = `${addon.id}-${catalog.type}-${catalog.id}`;
          if (!selectedKeys.has(key)) {
            available.push({
              id: key,
              label: catalog.name ?? catalog.id,
              secondaryLabel: `${addon.manifest.name} • ${catalog.type}`,
              addonId: addon.id,
              catalogId: catalog.id,
              catalogType: catalog.type,
            });
          }
        });
      });
    return available;
  }, [addons, heroCatalogSources]);

  const handleCatalogChange = useCallback(
    (next: CatalogOrderableItem[]) => {
      const sources: HeroCatalogSource[] = next.map((item) => ({
        addonId: item.addonId,
        catalogId: item.catalogId,
        catalogType: item.catalogType,
      }));
      setHeroCatalogSources(sources);
    },
    [setHeroCatalogSources]
  );

  const handleItemCountChange = useCallback(
    (count: number) => {
      setHeroItemCount(count);
    },
    [setHeroItemCount]
  );

  const content = (
    <Box paddingVertical="m" paddingHorizontal="m" gap="l">
      <SettingsCard title="Hero Section">
        <SettingsSwitch
          label="Show Hero Section"
          description="Display a featured content carousel at the top of the home screen"
          value={heroEnabled}
          onValueChange={setHeroEnabled}
        />

        <Box gap="s">
          <SliderInput
            minimumValue={3}
            maximumValue={15}
            step={1}
            value={heroItemCount}
            label="Number of Items"
            onValueChange={handleItemCountChange}
            showButtons
          />
        </Box>
      </SettingsCard>

      <SettingsCard title="Hero Content Sources">
        <Text variant="bodySmall" color="textPrimary" marginBottom="m">
          Configure which catalogs provide content for the hero section. Random items will be
          selected and refreshed every {HERO_CONTENT_REFRESH_MS / 1000 / 60} minutes.
        </Text>
        <OrderableListSection
          selectedItems={selectedCatalogs}
          availableItems={availableCatalogs}
          onChange={handleCatalogChange}
          selectedLabel="Selected catalogs"
          availableLabel="Add catalog"
          emptyPlaceholder="No catalogs selected"
        />
      </SettingsCard>
    </Box>
  );

  if (scrollable) {
    return <ScrollView showsVerticalScrollIndicator={false}>{content}</ScrollView>;
  }

  return content;
});

HomeSettingsContent.displayName = 'HomeSettingsContent';
