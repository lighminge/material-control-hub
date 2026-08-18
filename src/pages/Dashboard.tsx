import { useState, useEffect, useMemo } from 'react';
import { getCollection } from '@/lib/firebase/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, LabelList } from 'recharts';
import { differenceInDays, parseISO, format, subDays } from 'date-fns';
import { ClipboardList, ShieldAlert, Package, TrendingUp } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalRequisitions: 0,
    activeControls: 0,
    avgControlDays: '0.00'
  });

  const [controls, setControls] = useState<any[]>([]);
  const [controlTrendData, setControlTrendData] = useState<any[]>([]);
  const [controlDaysData, setControlDaysData] = useState<any[]>([]);
  const [chartType, setChartType] = useState<'bar' | 'line' | 'both'>('bar');
  const [trendChartType, setTrendChartType] = useState<'bar' | 'line' | 'both'>('line');
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [availableYears, setAvailableYears] = useState<string[]>([]);

  const totalControlItems = useMemo(() => {
    return controls.reduce((sum, c) => sum + (c.items?.length || 0), 0);
  }, [controls]);

  const totalRestockedItems = useMemo(() => {
    return controls.reduce((sum, c) => sum + (c.items?.filter((i: any) => i.missingQuantity === 0).length || 0), 0);
  }, [controls]);

  const calculateDays = (control: any, reqs: any[]) => {
    const req = reqs.find((r: any) => r.id === control.requisitionId || r.displayId === control.requisitionId);
    if (!req || !req.returnDate) return 0;
    const start = parseISO(req.returnDate);
    const end = control.completionDate ? parseISO(control.completionDate) : new Date();
    return Math.max(0, differenceInDays(end, start));
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [reqs, controlsData] = await Promise.all([
          getCollection('requisitions'),
          getCollection('controls')
        ]);

        const getYearFromDate = (dateVal: any, defaultYear: string) => {
          if (!dateVal) return defaultYear;
          if (typeof dateVal === 'string') return dateVal.substring(0, 4);
          if (dateVal.seconds) return new Date(dateVal.seconds * 1000).getFullYear().toString();
          if (dateVal.toDate) return dateVal.toDate().getFullYear().toString();
          return defaultYear;
        };

        const yearsSet = new Set<string>();
        reqs.forEach((r: any) => {
          const y = getYearFromDate(r.createdAt || r.completionDate, '');
          if (y && !isNaN(parseInt(y))) yearsSet.add(y);
        });
        controlsData.forEach((c: any) => {
          if (c.startDate) yearsSet.add(c.startDate.substring(0, 4));
        });
        
        const currentYear = new Date().getFullYear().toString();
        yearsSet.add(currentYear);
        const sortedYears = Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
        setAvailableYears(sortedYears);

        // Filter data by year
        const filteredReqs = reqs.filter((r: any) => {
          const y = getYearFromDate(r.createdAt || r.completionDate, currentYear);
          return y === selectedYear;
        });

        const filteredControls = controlsData.filter((c: any) => {
          return c.startDate.substring(0, 4) === selectedYear;
        });

        setControls(filteredControls);
        const activeControls = filteredControls.filter((c: any) => c.status === '處理中');
        
        let totalDays = 0;
        filteredControls.forEach((c: any) => {
          totalDays += calculateDays(c, reqs);
        });

        setStats({
          totalRequisitions: filteredReqs.length,
          activeControls: activeControls.length,
          avgControlDays: filteredControls.length > 0 ? (totalDays / filteredControls.length).toFixed(2) : '0.00'
        });

        // The trend is 7 days, which is fine to keep as the last 7 days of the selected year? 
        // Or last 7 days from now. Let's keep the last 7 days from now as it's a 'Recent 7 days' trend.
        const last7Days = Array.from({ length: 7 }).map((_, i) => format(subDays(new Date(), 6 - i), 'yyyy-MM-dd'));
        const trendData = last7Days.map(date => {
          const count = filteredControls.filter((c: any) => c.startDate === date).length;
          return { name: format(parseISO(date), 'MM/dd'), "數量": count };
        });
        setControlTrendData(trendData);

        const counts = Array(8).fill(0);
        filteredControls.forEach((c: any) => {
          const d = calculateDays(c, reqs);
          if (d === 0) counts[0]++;
          else if (d < 7) counts[d]++;
          else counts[7]++;
        });
        
        const daysData = counts.map((count, index) => ({
          name: index === 7 ? '7天以上' : index === 0 ? '0天' : `${index}天`,
          "數量": count
        }));
        setControlDaysData(daysData);

      } catch (error) {
        console.error("Error loading dashboard data:", error);
      }
    };

    loadData();
  }, [selectedYear]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-muted/30 p-4 rounded-xl border border-border/50">
        <h1 className="text-3xl font-bold tracking-tight text-primary">儀表板總覽</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-muted-foreground">西元年度</span>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[120px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map(year => (
                <SelectItem key={year} value={year}>{year} 年</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
            <div className="text-2xl font-bold">{totalControlItems}</div>
            <p className="text-xs text-muted-foreground mt-1">
              已補完: <span className="font-bold text-green-600">{totalRestockedItems}</span> 項
            </p>
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
                    <Bar dataKey="數量" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={50}>
                      <LabelList dataKey="數量" position="top" />
                    </Bar>
                  )}
                  {(trendChartType === 'line' || trendChartType === 'both') && (
                    <Line type="monotone" dataKey="數量" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }}>
                      <LabelList dataKey="數量" position="top" />
                    </Line>
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
                    <Bar dataKey="數量" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} maxBarSize={30}>
                      <LabelList dataKey="數量" position="top" />
                    </Bar>
                  )}
                  {(chartType === 'line' || chartType === 'both') && (
                    <Line type="monotone" dataKey="數量" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }}>
                      <LabelList dataKey="數量" position="top" />
                    </Line>
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
