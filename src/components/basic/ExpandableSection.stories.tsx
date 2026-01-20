import type { Meta, StoryObj } from '@storybook/react-native';
import { ExpandableSection } from './ExpandableSection';
import { Box } from '@/theme/theme';

const meta: Meta<typeof ExpandableSection> = {
  title: 'Basic/ExpandableSection',
  component: ExpandableSection,
  decorators: [
    (Story) => (
      <Box padding="m" backgroundColor="mainBackground" flex={1} justifyContent="center">
        <Box width={360} alignSelf="center">
          <Story />
        </Box>
      </Box>
    ),
  ],
  args: { title: 'Details' },
};

export default meta;

type Story = StoryObj<typeof ExpandableSection>;

export const Default: Story = {
  render: (args) => (
    <ExpandableSection {...args}>
      <Box padding="m">This is expandable content.</Box>
    </ExpandableSection>
  ),
};

export const WithExtraContent: Story = {
  render: (args) => (
    <ExpandableSection {...args} hasExtraContent>
      {({ mode, isExpanded, textProps }) => (
        <Box>
          <Box>
            <Box padding="m">
              <Text numberOfLines={textProps.numberOfLines}>
                This paragraph is long enough to demonstrate the collapse and expansion behavior.
                When expanded, additional content will be visible below.
              </Text>
            </Box>
            {mode === 'display' && isExpanded ? (
              <Box padding="m">
                <Text>Extra expanded content shows here.</Text>
              </Box>
            ) : null}
          </Box>
        </Box>
      )}
    </ExpandableSection>
  ),
};

export const CollapsedTwoLines: Story = {
  args: { collapsedLines: 2 },
  render: (args) => (
    <ExpandableSection {...args}>
      {({ textProps }) => (
        <Text numberOfLines={textProps.numberOfLines}>
          Line one. Line two. Line three that should be hidden initially.
        </Text>
      )}
    </ExpandableSection>
  ),
};
