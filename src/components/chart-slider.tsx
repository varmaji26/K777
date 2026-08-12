
'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { chartData } from '@/lib/data';
import type { ChartData } from '@/lib/types';
import { TrendingUp } from 'lucide-react';

const chartConfig = {
  value: {
    label: 'Value',
    color: 'hsl(var(--primary))',
  },
};

function ChartCard({ item }: { item: ChartData }) {
  return (
    <Card className="h-full border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-primary">
          <TrendingUp className="w-5 h-5" />
          {item.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <BarChart accessibilityLayer data={item.data}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => value.slice(0, 6)}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="value" fill="var(--color-value)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function ChartSlider() {
  // Display only the first chart as per the image
  const firstChart = chartData[0];

  if (!firstChart) {
    return null;
  }

  return (
    <section>
      <div className="p-1 h-full">
        <ChartCard item={firstChart} />
      </div>
    </section>
  );
}
