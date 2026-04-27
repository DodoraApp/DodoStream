/**
 * Per-profile addon configuration. Shared between the local addon store and
 * the remote UI so both boundaries stay in sync.
 */
export interface AddonConfig {
  isActive: boolean;
  useCatalogsOnHome: boolean;
  useCatalogsInSearch: boolean;
  useForSubtitles: boolean;
}
