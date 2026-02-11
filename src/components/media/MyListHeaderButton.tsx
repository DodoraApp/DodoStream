import { memo } from 'react';
import { Button } from '@/components/basic/Button';
import { TVFocusGuideView } from 'react-native';

export interface MyListHeaderButtonProps {
  isInMyList: boolean;
  onPress: () => void;
  hasTVPreferredFocus?: boolean;
}

export const MyListHeaderButton = memo(
  ({ isInMyList, onPress, hasTVPreferredFocus = false }: MyListHeaderButtonProps) => {
    return (
      <TVFocusGuideView trapFocusRight>
        <Button
          variant="secondary"
          icon={isInMyList ? 'bookmark' : 'bookmark-outline'}
          onPress={onPress}
          hasTVPreferredFocus={hasTVPreferredFocus}
        />
      </TVFocusGuideView>
    );
  }
);

MyListHeaderButton.displayName = 'MyListHeaderButton';
