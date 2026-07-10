import type { Meta, StoryObj } from "@storybook/react";

import { Badge } from "./badge";

const meta: Meta<typeof Badge> = {
  title: "UI/Badge",
  component: Badge,
  args: {
    children: "Unread",
  },
  argTypes: {
    variant: {
      control: { type: "select" },
      options: ["default", "secondary", "outline", "destructive", "ghost"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {};

export const Success: Story = {
  args: {
    children: "Ready",
    variant: "secondary",
  },
};
