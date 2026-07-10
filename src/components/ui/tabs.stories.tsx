import type { Meta, StoryObj } from "@storybook/react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { Card, CardContent } from "./card";

const meta: Meta = {
  title: "UI/Tabs",
  render: () => (
    <Tabs defaultValue="overview" className="w-[400px]">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="notes">Notes</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <Card>
          <CardContent className="pt-4 text-sm text-muted-foreground">
            Overview content goes here.
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="notes">
        <Card>
          <CardContent className="pt-4 text-sm text-muted-foreground">
            Notes content goes here.
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="history">
        <Card>
          <CardContent className="pt-4 text-sm text-muted-foreground">
            History content goes here.
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  ),
};

export default meta;
type Story = StoryObj;

export const Default: Story = {};

export const TwoTabs: Story = {
  render: () => (
    <Tabs defaultValue="a" className="w-[300px]">
      <TabsList>
        <TabsTrigger value="a">Card View</TabsTrigger>
        <TabsTrigger value="b">Board View</TabsTrigger>
      </TabsList>
      <TabsContent value="a">
        <p className="text-sm text-muted-foreground mt-2">Card layout content.</p>
      </TabsContent>
      <TabsContent value="b">
        <p className="text-sm text-muted-foreground mt-2">Board layout content.</p>
      </TabsContent>
    </Tabs>
  ),
};
