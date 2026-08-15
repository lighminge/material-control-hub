import { useState, useEffect } from 'react';
import { getCollection } from '@/lib/firebase/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart } from 'recharts';
import { differenceInDays, parseISO, format, subDays } from 'date-fns';
import { ClipboardList, ShieldAlert, Package, TrendingUp } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalRequisitions: 0,
    activeControls: 0,
    totalControlMaterials: 0,
    avgControlDays: 0
  });

  const [controlTrendData, setControlTrendData] = useState<any[]>([]);
  const [controlDaysData, setControlDaysData] = useState<any[]>([]);
  const [chartType, setChartType] = useState<'bar' | 'line' | 'both'>('bar');
  const [trendChartType, setTrendChartType] = useState<'bar' | 'line' | 'both'>('line');

  useEffect(() => {
    const loadData = async () => {
      try {
        const [reqs, controls] = await Promise.all([
          getCollection('requisitions'),
          getCollection('controls')
        ]);

        const activeControls = controls.filter((c: any) => c.status === '處理中');
        
        let totalDays = 0;
        let totalControlMaterials = 0;
        const daysDistribution = { '1-3天': 0, '4-7天': 0, '8-14天': 0, '15天以上': 0 };
        
        controls.forEach((c: any) => {
          // Calculate average days
          const days = Math.max(0, differenceInDays(c.endDate ? parseISO(c.endDate) : new Date(), parseISO(c.startDate)));
          totalDays += days;
          
          if (days <= 3) daysDistribution['1-3天']++;
          else if (days <= 7) daysDistribution['4-7天']++;
          else if (days <= 14) daysDistribution['8-14天']++;
          else daysDistribution['15天以上']++;
        });

        activeControls.forEach((c: any) => {
          totalControlMaterials += (c.items?.length || 0);
        });

        setStats({
          totalRequisitions: reqs.length,
          activeControls: activeControls.length,
          totalControlMaterials: totalControlMaterials,
          avgControlDays: controls.length > 0 ? Math.round(totalDays / controls.length) : 0
        });

        setControlDaysData([
          { name: '1-3天', count: daysDistribution['1-3天'] },
          { name: '4-7天', count: daysDistribution['4-7天'] },
          { name: '8-14天', count: daysDistribution['8-14天'] },
          { name: '15天以上', count: daysDistribution['15天以上'] }
        ]);

        // Real trend data for last 7 days
        const trend = Array.from({ length: 7 }).map((_, i) => {
          const date = subDays(new Date(), 6 - i);
          const dateStr = format(date, 'yyyy-MM-dd');
          const displayStr = format(date, 'MM/dd');
          const count = controls.filter((c: any) => c.startDate === dateStr).length;
          return { name: displayStr, count };
        });
        setControlTrendData(trend);

      } catch (error) {
        console.error("Error loading dashboard data:", error);
      }
    };

    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-primary">儀表板總覽</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">總領料單數</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRequisitions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">管制中單據</CardTitle>
            <ShieldAlert className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.activeControls}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">管制物料總數</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalControlMaterials}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均管制天數</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgControlDays} <span className="text-sm font-normal text-muted-foreground">天</span></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 flex flex-col">
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div>
              <CardTitle>近七日管制單數量趨勢</CardTitle>
              <CardDescription>每日新增的物料管制單數量</CardDescription>
            </div>
            <Select value={trendChartType} onValueChange={(val: 'bar'|'line'|'both') => setTrendChartType(val)}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue placeholder="切換圖表" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">長條圖</SelectItem>
                <SelectItem value="line">折線圖</SelectItem>
                <SelectItem value="both">二者並存</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="flex-1 pb-4 pl-2">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={controlTrendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tickMargin={10} />
                  <YAxis axisLine={false} tickLine={false} tickMargin={10} allowDecimals={false} />
                  <Tooltip />
                  {(trendChartType === 'bar' || trendChartType === 'both') && (
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  )}
                  {(trendChartType === 'line' || trendChartType === 'both') && (
                    <Line type="monotone" dataKey="count" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        <Card className="col-span-3 flex flex-col">
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div>
              <CardTitle>管制天數分佈</CardTitle>
              <CardDescription>所有管制單的處理時長分佈</CardDescription>
            </div>
            <Select value={chartType} onValueChange={(val: 'bar'|'line'|'both') => setChartType(val)}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue placeholder="切換圖表" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">長條圖</SelectItem>
                <SelectItem value="line">折線圖</SelectItem>
                <SelectItem value="both">二者並存</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="flex-1 pb-4">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={controlDaysData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tickMargin={10} />
                  <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} />
                  {(chartType === 'bar' || chartType === 'both') && (
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  )}
                  {(chartType === 'line' || chartType === 'both') && (
                    <Line type="monotone" dataKey="count" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 4 }} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
