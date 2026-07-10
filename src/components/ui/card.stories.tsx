import type { Meta, StoryObj } from "@storybook/react";

import { Badge } from "./badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";

const meta: Meta<typeof Card> = {
  title: "UI/Card",
  component: Card,
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card style={{ width: 360 }}>
      <CardHeader>
        <Badge variant="secondary">Paper</Badge>
        <CardTitle>ICLR submission draft</CardTitle>
        <CardDescription>Track the research narrative before you forget the shape of the argument.</CardDescription>
      </CardHeader>
      <CardContent>Milestones, notes, and reviewer response live here.</CardContent>
    </Card>
  ),
};
