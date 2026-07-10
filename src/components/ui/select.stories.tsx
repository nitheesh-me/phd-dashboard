import type { Meta, StoryObj } from "@storybook/react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

const meta: Meta = {
  title: "UI/Select",
  render: (args) => (
    <Select {...args}>
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Pick a status…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="unread">Unread</SelectItem>
        <SelectItem value="reading">Reading</SelectItem>
        <SelectItem value="read">Read</SelectItem>
        <SelectItem value="archived">Archived</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export default meta;
type Story = StoryObj;

export const Default: Story = {};

export const DefaultValue: Story = {
  args: { defaultValue: "reading" },
};

export const Disabled: Story = {
  render: () => (
    <Select disabled>
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Disabled" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="unread">Unread</SelectItem>
      </SelectContent>
    </Select>
  ),
};
