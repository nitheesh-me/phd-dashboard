import type { Meta, StoryObj } from "@storybook/react";

import { Input } from "./input";

const meta: Meta<typeof Input> = {
  title: "UI/Input",
  component: Input,
  args: {
    placeholder: "Type a project path",
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {};
