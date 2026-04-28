import { FC, memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native-gesture-handler';

import { SliderInput } from '@/components/basic/SliderInput';
import { OrderableItem, OrderableListSection } from '@/components/settings/OrderableListSection';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsSwitch } from '@/components/settings/SettingsSwitch';
import { HERO_CONTENT_REFRESH_MS } from '@/constants/ui';
import { useAddonStore } from '@/store/addon.store';
import { HeroCatalogSource, useHomeStore } from '@/store/home.store';
import { useProfileStore } from '@/store/profile.store';
import { Box, Text } from '@/theme/theme';

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
  const { t } = useTranslation('settings');
  const {
    heroEnabled,
    heroItemCount,
    heroCatalogSources,
    continueWatchingEnabled,
    myListEnabled,
    setHeroEnabled,
    setHeroItemCount,
    setHeroCatalogSources,
    setContinueWatchingEnabled,
    setMyListEnabled,
  } = useHomeStore((state) => ({
    heroEnabled: state.getActiveSettings().heroEnabled,
    heroItemCount: state.getActiveSettings().heroItemCount,
    heroCatalogSources: state.getActiveSettings().heroCatalogSources,
    continueWatchingEnabled: state.getActiveSettings().continueWatchingEnabled,
    myListEnabled: state.getActiveSettings().myListEnabled,
    setHeroEnabled: state.setHeroEnabled,
    setHeroItemCount: state.setHeroItemCount,
    setHeroCatalogSources: state.setHeroCatalogSources,
    setContinueWatchingEnabled: state.setContinueWatchingEnabled,
    setMyListEnabled: state.setMyListEnabled,
  }));

  const addons = useAddonStore((state) => state.addons);
  const configsByProfile = useAddonStore((state) => state.configsByProfile);
  const activeProfileId = useProfileStore((state) => state.activeProfileId);

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
      .filter(
        (addon) =>
          configsByProfile[activeProfileId ?? '']?.[addon.id]?.isActive &&
          configsByProfile[activeProfileId ?? '']?.[addon.id]?.useCatalogsOnHome
      )
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
  }, [addons, configsByProfile, activeProfileId, heroCatalogSources]);

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
      <SettingsCard title={t('home.catalogs')}>
        <SettingsSwitch
          label={t('home.continue_watching')}
          description={t('home.continue_watching_desc')}
          value={continueWatchingEnabled}
          onValueChange={setContinueWatchingEnabled}
        />
        <SettingsSwitch
          label={t('home.my_list')}
          description={t('home.my_list_desc')}
          value={myListEnabled}
          onValueChange={setMyListEnabled}
        />
      </SettingsCard>

      <SettingsCard title={t('home.hero_section')}>
        <SettingsSwitch
          label={t('home.show_hero')}
          description={t('home.show_hero_desc')}
          value={heroEnabled}
          onValueChange={setHeroEnabled}
        />

        <Box gap="s">
          <SliderInput
            minimumValue={3}
            maximumValue={15}
            step={1}
            value={heroItemCount}
            label={t('home.item_count')}
            onValueChange={handleItemCountChange}
            showButtons
          />
        </Box>
      </SettingsCard>

      <SettingsCard title={t('home.hero_sources')}>
        <Text variant="bodySmall" color="textPrimary" marginBottom="m">
          {t('home.hero_sources_desc', { minutes: HERO_CONTENT_REFRESH_MS / 1000 / 60 })}
        </Text>
        <OrderableListSection
          selectedItems={selectedCatalogs}
          availableItems={availableCatalogs}
          onChange={handleCatalogChange}
          selectedLabel={t('home.selected_catalogs')}
          availableLabel={t('home.add_catalog')}
          emptyPlaceholder={t('home.no_catalogs')}
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
