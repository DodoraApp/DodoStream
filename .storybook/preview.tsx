import React from 'react';
import type { Preview, Decorator } from '@storybook/react-native';
import { ThemeProvider } from '@shopify/restyle';
import theme from '../src/theme/theme';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts,
  Outfit_400Regular,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from '@expo-google-fonts/outfit';
import { Poppins_400Regular, Poppins_600SemiBold } from '@expo-google-fonts/poppins';

const WithTheme: Decorator = (Story) => {
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Poppins_400Regular,
    Poppins_600SemiBold,
  });

  if (!fontsLoaded) {
    return <></>;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider theme={theme}>
        <Story />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
};

const preview: Preview = {
  decorators: [WithTheme],
};

export default preview;
