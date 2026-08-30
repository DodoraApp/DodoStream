import { memo } from 'react';

import { Button } from '@/components/basic/Button';

export interface MyListHeaderButtonProps {
  isInMyList: boolean;
  onPress: () => void;
  hasTVPreferredFocus?: boolean;
  testID?: string;
}

export const MyListHeaderButton = memo(
  ({ isInMyList, onPress, hasTVPreferredFocus = false, testID }: MyListHeaderButtonProps) => {
    return (
      <Button
        variant="secondary"
        icon={isInMyList ? 'bookmark' : 'bookmark-outline'}
        onPress={onPress}
        hasTVPreferredFocus={hasTVPreferredFocus}
        testID={testID}
      />
    );
  }
);

MyListHeaderButton.displayName = 'MyListHeaderButton';
