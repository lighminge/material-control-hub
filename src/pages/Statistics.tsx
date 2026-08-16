import { useState, useEffect, useMemo } from 'react';
import { getCollection } from '@/lib/firebase/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { differenceInDays, parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { ClipboardList, ShieldAlert, TrendingUp, PieChart } from 'lucide-react';

export default function StatisticsPage() {
  const [controls, setControls] = useState<any[]>([]);
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [category, setCategory] = useState('all');

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

  const calculateDays = (start: string, end: string | null) => {
    return Math.max(1, differenceInDays(end ? parseISO(end) : new Date(), parseISO(start)));
  };

  const stats = useMemo(() => {
    // Helper to check date range
    const isWithinRange = (dateStr: string) => {
      if (!dateStr) return false;
      const d = parseISO(dateStr);
      if (startDate && isBefore(d, startOfDay(parseISO(startDate)))) return false;
      if (endDate && isAfter(d, endOfDay(parseISO(endDate)))) return false;
      return true;
    };

    // Filter Requisitions
    const filteredReqs = requisitions.filter(req => {
      // For reqs, we check if they have a date.
      const dateToUse = req.createdAt || req.completionDate;
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
        const hasCategory = ctrl.items.some((item: any) => {
          const mat = materials.find(m => m.id === item.materialId);
          return (mat?.category || '未分類') === category;
        });
        if (!hasCategory) return false;
      }
      
      return true;
    });

    let totalDays = 0;
    filteredControls.forEach(c => {
      totalDays += calculateDays(c.startDate, c.completionDate || null);
    });

    return {
      reqCount: filteredReqs.length,
      ctrlCount: filteredControls.length,
      avgDays: filteredControls.length > 0 ? (totalDays / filteredControls.length).toFixed(2) : '0.00'
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
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ colorScheme: 'light dark' }} />
          </div>
          <div className="space-y-2">
            <Label>管制開始日期區間 (迄)</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ colorScheme: 'light dark' }} />
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
    </div>
  );
}
