import * as mockReact from 'react';
import React from 'react';
import { View as mockView } from 'react-native';

import { fireEvent } from '@testing-library/react-native';

import { PICKER_POPUP_MAX_ITEMS } from '@/constants/ui';
import { renderWithProviders } from '@/utils/test-utils';

import { type PickerItem, PickerModal } from '../PickerModal';

let mockModalProps: Record<string, any> | undefined;

jest.mock('@/components/basic/Modal', () => ({
  Modal: (props: Record<string, any>) => {
    mockModalProps = props;
    return props.visible
      ? mockReact.createElement(mockView, { testID: 'modal' }, props.children)
      : null;
  },
}));
jest.mock('@legendapp/list/react-native', () => ({
  LegendList: (props: Record<string, any>) =>
    mockReact.createElement(
      mockView,
      { testID: 'picker-list' },
      props.data.map((item: any, index: number) =>
        mockReact.createElement(
          mockReact.Fragment,
          { key: props.keyExtractor(item) },
          props.renderItem({ item, index })
        )
      )
    ),
}));
jest.mock('@/utils/debug', () => ({ createDebugLogger: () => jest.fn() }));

const itemsOf = (count: number): PickerItem<string>[] =>
  Array.from({ length: count }, (_, index) => ({
    label: `Entry ${index + 1}`,
    value: `value-${index + 1}`,
  }));

describe('PickerModal', () => {
  const onValueChange = jest.fn();
  const onClose = jest.fn();

  const renderPicker = (props: Partial<React.ComponentProps<typeof PickerModal<string>>>) =>
    renderWithProviders(
      <PickerModal<string>
        visible
        label="Menu"
        items={itemsOf(2)}
        onValueChange={onValueChange}
        onClose={onClose}
        {...props}
      />
    );

  beforeEach(() => {
    jest.clearAllMocks();
    mockModalProps = undefined;
  });

  it('opens a short menu as a popup sized to its entries', () => {
    const { getByTestId, queryByTestId, getByText } = renderPicker({
      items: itemsOf(PICKER_POPUP_MAX_ITEMS),
    });

    expect(mockModalProps?.fitContent).toBe(true);
    expect(getByTestId('picker-popup')).toBeTruthy();
    expect(queryByTestId('picker-list')).toBeNull();
    expect(getByText(`Entry ${PICKER_POPUP_MAX_ITEMS}`)).toBeTruthy();
  });

  it('keeps the popup entries scrollable when the screen is short', () => {
    const { getByTestId } = renderPicker({ items: itemsOf(PICKER_POPUP_MAX_ITEMS) });

    expect(getByTestId('picker-popup').type).toBe('RCTScrollView');
  });

  it('reports the chosen entry and closes', () => {
    const { getByText } = renderPicker({});

    fireEvent.press(getByText('Entry 2'));

    expect(onValueChange).toHaveBeenCalledWith('value-2');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the full-height list for long menus', () => {
    const { getByTestId, queryByTestId } = renderPicker({
      items: itemsOf(PICKER_POPUP_MAX_ITEMS + 1),
    });

    expect(mockModalProps?.fitContent).toBeFalsy();
    expect(getByTestId('picker-list')).toBeTruthy();
    expect(queryByTestId('picker-popup')).toBeNull();
  });

  it('keeps the full-height list for grouped menus, which show a filter row', () => {
    const { getByTestId } = renderPicker({
      items: [
        { label: 'English', value: 'en', groupId: 'a' },
        { label: 'German', value: 'de', groupId: 'b' },
      ],
    });

    expect(mockModalProps?.fitContent).toBeFalsy();
    expect(getByTestId('picker-list')).toBeTruthy();
  });
});
