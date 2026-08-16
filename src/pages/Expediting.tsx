import { useState, useEffect, useMemo } from 'react';
import { getCollection } from '@/lib/firebase/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { differenceInDays, parseISO } from 'date-fns';
import { AlarmClock, ShieldAlert, TrendingUp } from 'lucide-react';

export default function ExpeditingPage() {
  const [controls, setControls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDay, setFilterDay] = useState<number | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const ctrls = await getCollection('controls');
        // Only active/incomplete controls
        const activeCtrls = ctrls.filter((c: any) => c.status === '處理中' || c.status === '缺料管制中');
        setControls(activeCtrls);
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const calculateDays = (start: string) => {
    return Math.max(1, differenceInDays(new Date(), parseISO(start)));
  };

  const dayGroups = useMemo(() => {
    const groups = {
      '1天': 0,
      '2天': 0,
      '3天': 0,
      '4天': 0,
      '5天': 0,
      '6天': 0,
      '7天以上': 0,
    };
    
    controls.forEach(c => {
      const days = calculateDays(c.startDate);
      if (days === 1) groups['1天']++;
      else if (days === 2) groups['2天']++;
      else if (days === 3) groups['3天']++;
      else if (days === 4) groups['4天']++;
      else if (days === 5) groups['5天']++;
      else if (days === 6) groups['6天']++;
      else groups['7天以上']++;
    });
    
    return groups;
  }, [controls]);

  const getLegendColorClass = (days: number) => {
    if (days === 1) return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-300';
    if (days === 2) return 'bg-green-200 text-green-800 border-green-400 dark:bg-green-900/60 dark:text-green-300';
    if (days === 3) return 'bg-lime-200 text-lime-800 border-lime-400 dark:bg-lime-900/60 dark:text-lime-300';
    if (days === 4) return 'bg-yellow-200 text-yellow-800 border-yellow-400 dark:bg-yellow-900/60 dark:text-yellow-300';
    if (days === 5) return 'bg-amber-200 text-amber-800 border-amber-400 dark:bg-amber-900/60 dark:text-amber-300';
    if (days === 6) return 'bg-orange-200 text-orange-800 border-orange-400 dark:bg-orange-900/60 dark:text-orange-300';
    return 'bg-red-500 text-white border-red-600 dark:bg-red-700 dark:text-white';
  };

  const getRowColorClass = (days: number) => {
    if (days === 1) return 'bg-emerald-50/50 hover:bg-emerald-100/50';
    if (days === 2) return 'bg-green-50 hover:bg-green-100';
    if (days === 3) return 'bg-lime-100/50 hover:bg-lime-200/50';
    if (days === 4) return 'bg-yellow-100 hover:bg-yellow-200';
    if (days === 5) return 'bg-amber-100 hover:bg-amber-200';
    if (days === 6) return 'bg-orange-100 hover:bg-orange-200';
    return 'bg-red-100 hover:bg-red-200 text-red-900';
  };

  const filteredControls = useMemo(() => {
    let result = controls;
    if (filterDay !== null) {
      result = result.filter(c => {
        const days = calculateDays(c.startDate);
        return filterDay === 7 ? days >= 7 : days === filterDay;
      });
    }
    return result.sort((a, b) => calculateDays(b.startDate) - calculateDays(a.startDate));
  }, [controls, filterDay]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-muted/30 p-4 rounded-xl border border-border/50">
        <div className="flex items-center gap-3">
          <AlarmClock className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight text-primary">稽催作業</h1>
        </div>
      </div>

      <Card className="p-4 bg-muted/30">
        <div className="mb-2 font-bold text-lg">管制天數分組統計與圖例</div>
        <div className="flex flex-wrap gap-4">
          {[1, 2, 3, 4, 5, 6, 7].map(d => {
            const label = d === 7 ? '7天以上' : `${d}天`;
            const count = dayGroups[label as keyof typeof dayGroups];
            const isActive = filterDay === d;
            return (
              <button 
                key={d} 
                onClick={() => setFilterDay(isActive ? null : d)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                  isActive ? 'ring-2 ring-primary ring-offset-2 bg-primary/5 shadow-md' : 'hover:bg-muted'
                } ${getLegendColorClass(d)}`}
              >
                <span className="font-bold text-sm">{label} ({count})</span>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">顯示中的管制單數</CardTitle>
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{filteredControls.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">顯示中的缺料項目總數</CardTitle>
            <AlarmClock className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {filteredControls.reduce((sum, c) => sum + c.items.length, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均管制天數</CardTitle>
            <TrendingUp className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">
              {filteredControls.length > 0 
                ? (filteredControls.reduce((sum, c) => sum + calculateDays(c.startDate), 0) / filteredControls.length).toFixed(2) 
                : '0.00'} 
              <span className="text-sm font-normal text-muted-foreground"> 天</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-lg">目前未補完之管制單清單</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">序號</TableHead>
                <TableHead>管制單號</TableHead>
                <TableHead>關聯領料單</TableHead>
                <TableHead>管制天數</TableHead>
                <TableHead>缺料項目總數</TableHead>
                <TableHead>已補完數</TableHead>
                <TableHead>狀態</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24">載入中...</TableCell>
                </TableRow>
              ) : filteredControls.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24">目前無符合天數的管制單</TableCell>
                </TableRow>
              ) : (
                filteredControls.map((control, index) => {
                  const days = calculateDays(control.startDate);
                  const rowClass = getRowColorClass(days >= 7 ? 7 : days);
                  return (
                    <TableRow key={control.id} className={rowClass}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-bold">{control.displayId || control.id?.slice(0, 8)}</TableCell>
                      <TableCell className="text-muted-foreground">{control.requisitionId.startsWith('領') ? control.requisitionId : control.requisitionId.slice(0, 8)}</TableCell>
                      <TableCell>
                        <span className="font-bold">{days} 天</span>
                      </TableCell>
                      <TableCell>{control.items.length}</TableCell>
                      <TableCell className="text-green-700 font-bold">{control.items.filter((i: any) => i.missingQuantity === 0).length}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-amber-500 hover:bg-amber-600 text-white border-0">
                          {control.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
