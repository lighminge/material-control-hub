import { useState, useEffect, useMemo } from 'react';
import { getCollection } from '@/lib/firebase/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { differenceInDays, parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { ClipboardList, ShieldAlert, TrendingUp, PieChart } from 'lucide-react';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, LabelList } from 'recharts';

export default function StatisticsPage() {
  const [controls, setControls] = useState<any[]>([]);
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [category, setCategory] = useState('all');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'both'>('bar');

  useEffect(() => {
    const loadData = async () => {
      try {
        const [ctrls, reqs, mats] = await Promise.all([
          getCollection('controls'),
          getCollection('requisitions'),
          getCollection('materials')
        ]);
        setControls(ctrls);
        setRequisitions(reqs);
        setMaterials(mats);
      } catch (error) {
        console.error("Error loading data:", error);
      }
    };
    loadData();
  }, []);

  const calculateDays = (control: any, reqs: any[]) => {
    const req = reqs.find((r: any) => r.id === control.requisitionId || r.displayId === control.requisitionId);
    if (!req || !req.returnDate) return 0;
    const start = parseISO(req.returnDate);
    const end = control.completionDate ? parseISO(control.completionDate) : new Date();
    return Math.max(0, differenceInDays(end, start));
  };

  const stats = useMemo(() => {
    // Helper to check date range
    const isWithinRange = (dateStr: string) => {
      if (!dateStr) return false;
      const d = parseISO(dateStr);
      if (isNaN(d.getTime())) return false;
      if (startDate && isBefore(d, startOfDay(parseISO(startDate)))) return false;
      if (endDate && isAfter(d, endOfDay(parseISO(endDate)))) return false;
      return true;
    };

    // Filter Requisitions
    const filteredReqs = requisitions.filter(req => {
      // For reqs, we check if they have a date.
      let dateToUse = req.createdAt || req.completionDate;
      if (dateToUse && typeof dateToUse !== 'string') {
        if (dateToUse.seconds) dateToUse = new Date(dateToUse.seconds * 1000).toISOString();
        else dateToUse = null;
      }
      if (dateToUse && !isWithinRange(dateToUse)) return false;
      
      // category filter
      if (category !== 'all' && (req.category || '未分類') !== category) return false;
      
      return true;
    });

    // Filter Controls
    const filteredControls = controls.filter(ctrl => {
      if (!isWithinRange(ctrl.startDate)) return false;
      
      if (category !== 'all') {
        // Check if any item in the control matches the category
        const hasCategory = (ctrl.items || []).some((item: any) => {
          const mat = materials.find(m => m.id === item.materialId);
          return (mat?.category || '未分類') === category;
        });
        if (!hasCategory) return false;
      }
      
      return true;
    });

    let totalDays = 0;
    const counts = Array(8).fill(0);
    
    filteredControls.forEach(c => {
      const d = calculateDays(c, requisitions);
      totalDays += d;
      if (d === 0) counts[0]++;
      else if (d < 7) counts[d]++;
      else counts[7]++;
    });

    const daysData = counts.map((count, index) => ({
      name: index === 7 ? '7天以上' : index === 0 ? '0天' : `${index}天`,
      "數量": count
    }));

    return {
      reqCount: filteredReqs.length,
      ctrlCount: filteredControls.length,
      avgDays: filteredControls.length > 0 ? (totalDays / filteredControls.length).toFixed(2) : '0.00',
      daysData
    };
  }, [controls, requisitions, materials, startDate, endDate, category]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-muted/30 p-4 rounded-xl border border-border/50">
        <div className="flex items-center gap-3">
          <PieChart className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight text-primary">統計作業</h1>
        </div>
      </div>

      <Card className="p-4 bg-muted/30">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>管制開始日期區間 (起)</Label>
            <Input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              style={{ colorScheme: 'light dark' }}
              onClick={(e) => {
                const target = e.target as HTMLInputElement;
                if (target.showPicker) target.showPicker();
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>管制開始日期區間 (迄)</Label>
            <Input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              style={{ colorScheme: 'light dark' }}
              onClick={(e) => {
                const target = e.target as HTMLInputElement;
                if (target.showPicker) target.showPicker();
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>物料分類</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="全部分類" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分類</SelectItem>
                <SelectItem value="未分類">未分類</SelectItem>
                <SelectItem value="TKW">TKW</SelectItem>
                <SelectItem value="夾鉗">夾鉗</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">總領料單數</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary">{stats.reqCount}</div>
            <p className="text-xs text-muted-foreground mt-2">符合查詢條件的領料單數量</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">總管制單數</CardTitle>
            <ShieldAlert className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-destructive">{stats.ctrlCount}</div>
            <p className="text-xs text-muted-foreground mt-2">符合查詢條件的管制單數量</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均管制天數</CardTitle>
            <TrendingUp className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-amber-500">{stats.avgDays} <span className="text-xl font-normal text-muted-foreground">天</span></div>
            <p className="text-xs text-muted-foreground mt-2">符合查詢條件的平均管制時長</p>
          </CardContent>
        </Card>
      </div>
      
      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-start justify-between pb-2">
          <div>
            <CardTitle>管制天數分佈圖</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">符合查詢條件之管制單處理時長</p>
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
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={stats.daysData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tickMargin={10} />
                <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} />
                {(chartType === 'bar' || chartType === 'both') && (
                  <Bar dataKey="數量" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} maxBarSize={40}>
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
  );
}
