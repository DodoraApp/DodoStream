/**
 * Types for the What's New feature
 */

export interface WhatsNewEntry {
  /** Unique numeric ID (e.g., '0001') used for cursor tracking */
  id: string;
  /** Display version string (e.g., 'v1.2.0') */
  version: string;
  /** Title extracted from first markdown heading */
  title: string;
  /** Full markdown body content */
  body: string;
  /** Optional image require() result */
  image?: number;
}
