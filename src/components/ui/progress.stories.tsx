import type { Meta, StoryObj } from "@storybook/react";

import { Progress } from "./progress";

const meta: Meta<typeof Progress> = {
  title: "UI/Progress",
  component: Progress,
  argTypes: {
    value: {
      control: { type: "range", min: 0, max: 100, step: 1 },
    },
  },
  args: {
    value: 40,
  },
  render: (args) => (
    <div className="w-64">
      <Progress {...args} />
    </div>
  ),
};

export default meta;
type Story = StoryObj<typeof Progress>;

export const Default: Story = {};

export const Complete: Story = { args: { value: 100 } };

export const Empty: Story = { args: { value: 0 } };

export const HalfDone: Story = { args: { value: 50 } };
