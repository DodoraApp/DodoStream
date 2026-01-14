import { createTheme, createBox, createText } from '@shopify/restyle';

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

const theme = createTheme({
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
        overlayBackground: 'rgba(0, 0, 0, 0.6)',
        semiTransparentBackground: 'rgba(0, 0, 0, 0.4)',

        playerBackground: palette.black,

        // Focus colors (for non-outline focus states)
        focusBackground: palette.dark3,
        focusForeground: palette.white,
        focusBackgroundPrimary: palette.greenLight,
    },
    spacing: {
        xs: 4,
        s: 8,
        m: 16,
        l: 24,
        xl: 32,
        xxl: 40,
    },
    borderRadii: {
        s: 6,
        m: 12,
        l: 16,
        xl: 24,
        full: 999,
    },
    // Card sizes for consistent dimensions
    cardSizes: {
        media: { width: 140, height: 200 },
        continueWatching: { width: 240, height: 140 },
        profile: { width: 140, height: 180 },
        episode: { width: 240, imageHeight: 120 },
        stream: { width: 340 },
    },
    // General sizes
    sizes: {
        inputHeight: 56,
        modalMinWidth: 300,
        modalMaxWidth: 500,
        logoMaxWidth: 360,
        logoHeight: 90,
        stickyLogoHeight: 44,
        loadingIndicatorSizeSmall: 44,
        loadingIndicatorSizeLarge: 72,
        loadingIndicatorLogoSizeSmall: 35,
        loadingIndicatorLogoSizeLarge: 65,
        progressBarHeight: 6,
    },
    // Focus styling for TV
    focus: {
        borderWidth: 4,
        borderWidthSmall: 3,
        scaleSmall: 1.01,
        scaleMedium: 1.05,
    },
    fonts,
    textVariants: {
        header: {
            fontFamily: 'Outfit_700Bold',
            fontSize: 32,
            color: 'textPrimary',
        },
        subheader: {
            fontFamily: 'Outfit_600SemiBold',
            fontSize: 24,
            color: 'textPrimary',
        },
        sectionLabel: {
            fontFamily: 'Outfit_600SemiBold',
            fontSize: 14,
            color: 'textSecondary',
            textTransform: 'uppercase' as const,
            letterSpacing: 0.5,
        },
        cardTitle: {
            fontFamily: 'Outfit_700Bold',
            fontSize: 18,
            color: 'textPrimary',
        },
        body: {
            fontFamily: 'Poppins_400Regular',
            fontSize: 16,
            lineHeight: 24,
            color: 'textPrimary',
        },
        bodySmall: {
            fontFamily: 'Poppins_400Regular',
            fontSize: 14,
            lineHeight: 20,
            color: 'textSecondary',
        },
        caption: {
            fontFamily: 'Poppins_400Regular',
            fontSize: 14,
            color: 'textSecondary',
        },
        button: {
            fontFamily: 'Outfit_600SemiBold',
            fontSize: 16,
            color: 'textPrimary',
        },
        defaults: {
            fontFamily: 'Poppins_400Regular',
            fontSize: 16,
            color: 'textPrimary',
        },
    },
    buttonVariants: {
        primary: {
            backgroundColor: 'primaryBackground',
            borderRadius: 'full',
            height: 50,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 'l',
        },
        secondary: {
            backgroundColor: 'semiTransparentBackground',
            borderRadius: 'full',
            height: 50,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 'l',
        },
        tertiary: {
            backgroundColor: 'transparent',
            height: 50,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 'l',
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
            fontSize: 14,
        }
    }
});

export type Theme = typeof theme;
export const Box = createBox<Theme>();
export const Text = createText<Theme>();
export default theme;

