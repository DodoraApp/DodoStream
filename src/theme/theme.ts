import { Breakpoint } from '@/hooks/useBreakpoint';
import { createTheme, createBox, createText } from '@shopify/restyle';
import { DimensionValue } from 'react-native';

const withScale = (value: number, scalingFactor: number) => value * scalingFactor;
const palette = {
    // Green - Primary Brand Color
    // Slightly cooler emerald tones for a more modern look.
    // Kept at a similar luminance to preserve the existing overall contrast.
    greenPrimary: '#10b943',
    greenLight: '#1dce52ff',
    greenDark: '#059669',

    // Dark - Backgrounds
    black: '#000000',
    dark1: '#181A20', // Main Background
    dark2: '#1F222A', // Card Background / Input Background
    dark3: '#35383F', // Borders / Separators

    // White / Greys - Text
    white: '#FFFFFF',
    grey1: '#E0E0E0',
    grey2: '#9E9E9E', // Secondary Text
    grey3: '#616161', // Disabled / Placeholder

    // Functional
    red: '#FF3B30',
    overlayBlack: 'rgba(0, 0, 0, 0.6)',
    semiTransparentBlack: 'rgba(0, 0, 0, 0.4)',
    transparent: 'transparent',

    // Accent (contrast to green)
    purplePrimary: '#7C3AED',
};

const fonts = {
    outfitRegular: 'Outfit_400Regular',
    outfitSemiBold: 'Outfit_600SemiBold',
    outfitBold: 'Outfit_700Bold',
    poppinsRegular: 'Poppins_400Regular',
    poppinsSemiBold: 'Poppins_600SemiBold',
    poppinsBold: 'Poppins_700Bold',
};

const createAppTheme = (scalingFactor: number) => createTheme({
    scalingFactor,
    breakpoints: {
        mobile: 0,
        tablet: 768,
        tv: 1024,
    },
    colors: {
        mainBackground: palette.dark1,
        mainForeground: palette.white,
        disabledForeground: palette.grey3,

        cardBackground: palette.dark2,
        cardBorder: palette.dark3,

        primaryBackground: palette.greenPrimary,
        primaryForeground: palette.white,

        secondaryBackground: palette.dark2,
        secondaryForeground: palette.white,
        secondaryBorder: palette.dark2,

        tertiaryBackground: palette.purplePrimary,
        tertiaryForeground: palette.white,

        textPrimary: palette.white,
        textSecondary: palette.grey2,
        textPlaceholder: palette.grey3,
        textLink: palette.greenPrimary,

        danger: palette.red,
        transparent: 'transparent',

        inputBackground: palette.dark2,

        // Overlay colors
        overlayBackground: palette.overlayBlack,
        semiTransparentBackground: palette.semiTransparentBlack,

        playerBackground: palette.black,

        // Focus colors (for non-outline focus states)
        focusBackground: palette.dark3,
        focusForeground: palette.white,
        focusBackgroundPrimary: palette.greenLight,
    },
    spacing: {
        xs: withScale(4, scalingFactor),
        s: withScale(8, scalingFactor),
        m: withScale(16, scalingFactor),
        l: withScale(24, scalingFactor),
        xl: withScale(32, scalingFactor),
        xxl: withScale(40, scalingFactor),
    },
    borderRadii: {
        s: withScale(6, scalingFactor),
        m: withScale(12, scalingFactor),
        l: withScale(16, scalingFactor),
        xl: withScale(24, scalingFactor),
        full: 999,
    },
    // Card sizes for consistent dimensions
    cardSizes: {
        media: { width: withScale(140, scalingFactor), height: withScale(200, scalingFactor) },
        continueWatching: { width: withScale(240, scalingFactor), height: withScale(140, scalingFactor) },
        profile: { width: withScale(140, scalingFactor), height: withScale(180, scalingFactor) },
        episode: { width: withScale(240, scalingFactor), imageHeight: withScale(120, scalingFactor) },
        stream: { width: withScale(340, scalingFactor) },
    },
    // General sizes
    sizes: {
        inputHeight: withScale(56, scalingFactor),
        iconSmall: withScale(16, scalingFactor),
        iconMedium: withScale(24, scalingFactor),
        iconLarge: withScale(32, scalingFactor),
        iconXLarge: withScale(48, scalingFactor),
        iconXXLarge: withScale(72, scalingFactor),
        modalMinWidth: {
            mobile: '100%',
            tablet: withScale(400, scalingFactor),
            tv: withScale(500, scalingFactor),
        } as Record<Breakpoint, DimensionValue>,
        modalMinWidthWide: {
            mobile: '100%',
            tablet: withScale(600, scalingFactor),
            tv: withScale(900, scalingFactor),
        } as Record<Breakpoint, DimensionValue>,
        modalMaxWidth: {
            mobile: '100%',
            tablet: '100%',
            tv: '100%',
        } as Record<Breakpoint, DimensionValue>,
        logoMaxWidth: withScale(360, scalingFactor),
        logoHeight: withScale(90, scalingFactor),
        stickyLogoHeight: withScale(44, scalingFactor),
        loadingIndicatorSizeSmall: withScale(44, scalingFactor),
        loadingIndicatorSizeLarge: withScale(72, scalingFactor),
        loadingIndicatorLogoSizeSmall: withScale(35, scalingFactor),
        loadingIndicatorLogoSizeLarge: withScale(65, scalingFactor),
        progressBarHeight: withScale(6, scalingFactor),
        mediaDetailsHeader: withScale(350, scalingFactor),
        // Tab bar (mobile only)
        tabBarHeight: withScale(65, scalingFactor),
        tabBarPaddingTop: withScale(10, scalingFactor),
        // Toast
        toastMaxWidth: withScale(400, scalingFactor),
        toastStackGap: withScale(8, scalingFactor),
        // App start animation
        appStartLogoSize: withScale(80, scalingFactor),
        // Hero section
        heroHeight: withScale(500, scalingFactor),
    },
    // Focus styling for TV
    focus: {
        borderWidth: withScale(4, scalingFactor),
        borderWidthSmall: withScale(3, scalingFactor),
        scaleSmall: 1.01,
        scaleMedium: 1.05,
        scaleLarge: 1.1,
    },
    fonts,
    textVariants: {
        header: {
            fontFamily: 'Outfit_700Bold',
            fontSize: withScale(32, scalingFactor),
            color: 'textPrimary',
        },
        subheader: {
            fontFamily: 'Outfit_600SemiBold',
            fontSize: withScale(24, scalingFactor),
            color: 'textPrimary',
        },
        sectionLabel: {
            fontFamily: 'Outfit_600SemiBold',
            fontSize: withScale(14, scalingFactor),
            color: 'textSecondary',
            textTransform: 'uppercase' as const,
            letterSpacing: withScale(.5, scalingFactor),
        },
        cardTitle: {
            fontFamily: 'Outfit_700Bold',
            fontSize: withScale(18, scalingFactor),
            color: 'textPrimary',
        },
        body: {
            fontFamily: 'Poppins_400Regular',
            fontSize: withScale(16, scalingFactor),
            lineHeight: withScale(24, scalingFactor),
            color: 'textPrimary',
        },
        bodySmall: {
            fontFamily: 'Poppins_400Regular',
            fontSize: withScale(14, scalingFactor),
            lineHeight: withScale(20, scalingFactor),
            color: 'textSecondary',
        },
        caption: {
            fontFamily: 'Poppins_400Regular',
            fontSize: withScale(14, scalingFactor),
            color: 'textSecondary',
        },
        button: {
            fontFamily: 'Outfit_600SemiBold',
            fontSize: withScale(16, scalingFactor),
            color: 'textPrimary',
        },
        defaults: {
            fontFamily: 'Poppins_400Regular',
            fontSize: withScale(16, scalingFactor),
            color: 'textPrimary',
        },
    },
    buttonVariants: {
        primary: {
            backgroundColor: 'primaryBackground',
            borderRadius: 'full',
            height: withScale(50, scalingFactor),
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 'm',
        },
        secondary: {
            backgroundColor: 'semiTransparentBackground',
            borderRadius: 'full',
            height: withScale(50, scalingFactor),
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 'm',
        },
        tertiary: {
            backgroundColor: 'transparent',
            height: withScale(50, scalingFactor),
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 'm',
        },
        defaults: {
            // Default styles applied if no variant matches
        }
    },
    cardVariants: {
        primary: {
            backgroundColor: 'cardBackground',
            borderRadius: 'l',
            padding: 'm',
        },
        defaults: {},
    },
    inputVariants: {
        default: {
            backgroundColor: 'inputBackground',
            borderRadius: 'm',
            padding: 'm',
            color: 'textPrimary',
            fontSize: withScale(14, scalingFactor),
        }
    }
});

const defaultTheme = createAppTheme(0.8);

export type Theme = typeof defaultTheme;
export const Box = createBox<Theme>();
export const Text = createText<Theme>();
export { createAppTheme, defaultTheme };

