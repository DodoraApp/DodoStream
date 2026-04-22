// Toast durations (milliseconds) for toast notifications
export const TOAST_DURATION_SHORT = 2000;
export const TOAST_DURATION_MEDIUM = 3000;
export const TOAST_DURATION_LONG = 4000;

// Toast animation timings (milliseconds)
export const TOAST_ENTER_DURATION_MS = 250;
export const TOAST_EXIT_DURATION_MS = 200;

// Toast layout
export const TOAST_MAX_VISIBLE = 5;

// Loading animation timings
export const LOADING_LOGO_ANIMATION_DURATION_MS = 800;

// App start animation
export const APP_START_LOGO_FADE_IN_MS = 500;
export const APP_START_TEXT_EXPAND_DELAY_MS = 600;
export const APP_START_TEXT_EXPAND_MS = 400;

// Profile selector exit animation
export const PROFILE_EXIT_ANIMATION_MS = 400;

// Skeleton shimmer/pulse timing
export const ANIMATION_SKELETON_PULSE_DURATION_MS = 1200;

// Fade-in timing for content after data loads
export const ANIMATION_FADE_IN_MS = 400;

// Hero section animation timings
export const HERO_AUTO_SCROLL_INTERVAL_MS = 8000;
export const HERO_CROSSFADE_DURATION_MS = 800;
export const HERO_CONTENT_SLIDE_DURATION_MS = 500;
export const HERO_CONTENT_SLIDE_DELAY_MS = 150;
export const HERO_DOT_ANIMATION_MS = 300;
export const HERO_CONTENT_REFRESH_MS = 1000 * 60 * 30; // 30 minutes - how often to pick new random items

// Network timeouts
export const ADDON_MANIFEST_FETCH_TIMEOUT_MS = 10_000;

// Setup Wizard
export const WIZARD_STEP_ANIMATION_MS = 300;
export const WIZARD_CONTENT_FADE_MS = 250;

// TV Focus animation timing
export const TV_FOCUS_ANIMATION_MS = 150;

// Details backdrop gradient stops (0–1 proportional values)
// Three-stop fade: fully transparent at top → semi-dark at ⅓ → solid background before content area
// The third stop must land above ~0.72 so the cast/episodes section always sits on a solid background.
export const DETAILS_BACKDROP_GRADIENT_LOCATIONS: [number, number, number] = [0, 0.35, 0.68];

// LegendList draw distance tuning to avoid image-loading avalanches
// when many items are missing metadata
export const TV_DRAW_DISTANCE = 400;
export const MOBILE_DRAW_DISTANCE = 150;

// Horizontal list draw distance — controls how many off-screen items are pre-rendered
// in each horizontal catalog row. Lower values = fewer simultaneous images.
export const TV_HORIZONTAL_DRAW_DISTANCE = 250;
export const MOBILE_HORIZONTAL_DRAW_DISTANCE = 120;

// Number of extra catalog rows to include in the priority batch beyond what fits on screen.
// This ensures the row just below the fold is also pre-loaded for smooth initial scrolling.
export const HOME_PRIORITY_BUFFER_ROWS = 1;

// Debounce delay for TV home screen scroll-to-section (milliseconds).
// Prevents rapid D-pad presses from firing multiple instant scrollToIndex calls,
// which can move the focused item off-screen and cause focus jumps.
export const TV_SCROLL_DEBOUNCE_MS = 150;

// Simkl PIN auth
export const SIMKL_PIN_TIMEOUT_S = 15 * 60; // 15 minutes in seconds
export const SIMKL_PIN_TIMEOUT_MS = SIMKL_PIN_TIMEOUT_S * 1000;
export const SIMKL_PIN_POLL_INTERVAL_MS = 3000;
export const SIMKL_AUTO_SYNC_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes (Simkl recommends 15-30 min)
