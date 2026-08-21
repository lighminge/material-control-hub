import { useState, useEffect, useMemo } from 'react';
import { getCollection } from '@/lib/firebase/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, LabelList } from 'recharts';
import { parseISO, format, subDays } from 'date-fns';
import { calculateWorkingDays } from '@/utils/dateUtils';
import { ClipboardList, ShieldAlert, Package, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalRequisitions: 0,
    activeControls: 0,
    avgControlDays: '0.00'
  });

  const [controls, setControls] = useState<any[]>([]);
  const [enrichedActiveControls, setEnrichedActiveControls] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  
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

  const calculateDays = (control: any, reqs: any[], hols: any[]) => {
    const req = reqs.find((r: any) => r.id === control.requisitionId || r.displayId === control.requisitionId);
    if (!req || !req.returnDate) return 0;
    return calculateWorkingDays(req.returnDate, control.completionDate, hols);
  };

  const getDaysBadgeColor = (days: number) => {
    if (days === 0) return 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800/50 dark:text-slate-300';
    if (days === 1) return 'bg-cyan-200 text-cyan-900 border-cyan-400 dark:bg-cyan-900/50 dark:text-cyan-300';
    if (days === 2) return 'bg-blue-200 text-blue-900 border-blue-400 dark:bg-blue-900/60 dark:text-blue-300';
    if (days === 3) return 'bg-lime-200 text-lime-800 border-lime-400 dark:bg-lime-900/60 dark:text-lime-300';
    if (days === 4) return 'bg-yellow-200 text-yellow-800 border-yellow-400 dark:bg-yellow-900/60 dark:text-yellow-300';
    if (days === 5) return 'bg-amber-200 text-amber-800 border-amber-400 dark:bg-amber-900/60 dark:text-amber-300';
    if (days === 6) return 'bg-orange-200 text-orange-800 border-orange-400 dark:bg-orange-900/60 dark:text-orange-300';
    return 'bg-red-500 text-white border-red-600 dark:bg-red-700 dark:text-white font-bold';
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [reqs, controlsData, holsData] = await Promise.all([
          getCollection('requisitions'),
          getCollection('controls'),
          getCollection('holidays')
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
        const activeControls = filteredControls.filter((c: any) => c.status === '處理中' || c.status === '缺料管制中');
        
        const enrichedList = activeControls.map(c => ({
          ...c,
          calculatedDays: calculateDays(c, reqs, holsData)
        })).sort((a, b) => b.calculatedDays - a.calculatedDays); // sort by days descending
        setEnrichedActiveControls(enrichedList);
        setCurrentPage(1);

        let totalDays = 0;
        filteredControls.forEach((c: any) => {
          totalDays += calculateDays(c, reqs, holsData);
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
          const d = calculateDays(c, reqs, holsData);
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
      <div className="flex items-center gap-6 bg-muted/30 p-4 rounded-xl border border-border/50">
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

      <div className="bg-white rounded-xl shadow-sm border border-border p-6 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h2 className="text-xl font-bold">目前未結案的所有管制單</h2>
            <div className="mt-2 text-sm bg-blue-100 text-blue-800 border border-blue-200 px-3 py-1.5 rounded-md inline-block font-bold shadow-sm">
              總共 {enrichedActiveControls.length} 筆未結案
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">每頁筆數</span>
              <Select value={pageSize.toString()} onValueChange={(val) => { setPageSize(Number(val)); setCurrentPage(1); }}>
                <SelectTrigger className="w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 bg-muted/20 p-2 rounded-lg border border-border/50 flex-wrap justify-end">
              <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded text-sm text-slate-800 border border-slate-300">0天</span>
              <span className="flex items-center gap-1.5 bg-cyan-200 px-2 py-1 rounded text-sm text-cyan-900 border border-cyan-400">1天</span>
              <span className="flex items-center gap-1.5 bg-blue-200 px-2 py-1 rounded text-sm text-blue-900 border border-blue-400">2天</span>
              <span className="flex items-center gap-1.5 bg-lime-200 px-2 py-1 rounded text-sm text-lime-800 border border-lime-400">3天</span>
              <span className="flex items-center gap-1.5 bg-yellow-200 px-2 py-1 rounded text-sm text-yellow-800 border border-yellow-400">4天</span>
              <span className="flex items-center gap-1.5 bg-amber-200 px-2 py-1 rounded text-sm text-amber-800 border border-amber-400">5天</span>
              <span className="flex items-center gap-1.5 bg-orange-200 px-2 py-1 rounded text-sm text-orange-800 border border-orange-400">6天</span>
              <span className="flex items-center gap-1.5 bg-red-500 px-2 py-1 rounded text-sm text-white border border-red-600 font-bold">7天以上</span>
            </div>
          </div>
        </div>

        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-16">序號</TableHead>
                <TableHead>管制單號</TableHead>
                <TableHead>關聯領料單</TableHead>
                <TableHead>管制開始日</TableHead>
                <TableHead>管制天數</TableHead>
                <TableHead>缺料項目清單</TableHead>
                <TableHead>狀態</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrichedActiveControls.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    太棒了！目前沒有未結案的管制單。
                  </TableCell>
                </TableRow>
              ) : (
                enrichedActiveControls
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map((c, index) => (
                    <TableRow key={c.id}>
                      <TableCell>{(currentPage - 1) * pageSize + index + 1}</TableCell>
                      <TableCell className="font-medium">{c.id}</TableCell>
                      <TableCell>
                        <span className="text-sm font-bold bg-purple-100 text-purple-700 border border-purple-200 px-2 py-1 rounded-md shadow-sm">
                          {c.requisitionId}
                        </span>
                      </TableCell>
                      <TableCell>{c.startDate}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center justify-center min-w-[2.5rem] py-1 rounded-md border ${getDaysBadgeColor(c.calculatedDays)}`}>
                          {c.calculatedDays}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {c.items?.filter((i: any) => i.missingQuantity > 0).map((i: any) => (
                            <span key={i.materialId} className="text-sm font-bold bg-red-100 text-red-700 border border-red-200 px-2 py-1 rounded-md shadow-sm">
                              {i.materialName || i.materialId}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full text-xs font-bold">
                          {c.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {enrichedActiveControls.length > 0 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              顯示第 {(currentPage - 1) * pageSize + 1} 到 {Math.min(currentPage * pageSize, enrichedActiveControls.length)} 筆，共 {enrichedActiveControls.length} 筆
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                上一頁
              </Button>
              <div className="flex items-center px-4 text-sm font-medium">
                {currentPage} / {Math.ceil(enrichedActiveControls.length / pageSize)}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(enrichedActiveControls.length / pageSize), p + 1))}
                disabled={currentPage === Math.ceil(enrichedActiveControls.length / pageSize)}
              >
                下一頁
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col">
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
        
        <Card className="flex flex-col">
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
