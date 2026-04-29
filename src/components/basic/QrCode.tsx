import { FC, memo } from 'react';
import QRCodeSvg from 'react-native-qrcode-svg';

import { useTheme } from '@shopify/restyle';

import { Box, type Theme } from '@/theme/theme';

interface QrCodeProps {
  value: string;
  size?: number;
}

/**
 * Reusable QR code with a slim white border.
 * Renders nothing when `value` is empty.
 */
export const QrCode: FC<QrCodeProps> = memo(({ value, size }) => {
  const theme = useTheme<Theme>();
  const resolvedSize = size ?? theme.sizes.qrCodeSize;

  if (!value) return null;

  return (
    <Box backgroundColor="mainForeground" padding="xs" borderRadius="s">
      <QRCodeSvg value={value} size={resolvedSize} />
    </Box>
  );
});

QrCode.displayName = 'QrCode';
