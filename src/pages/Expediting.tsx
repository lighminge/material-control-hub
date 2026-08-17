import { useState, useEffect, useMemo } from 'react';
import { getCollection } from '@/lib/firebase/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { differenceInDays, parseISO } from 'date-fns';
import { AlarmClock, ShieldAlert, TrendingUp } from 'lucide-react';

export default function ExpeditingPage() {
  const [controls, setControls] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDay, setFilterDay] = useState<number | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [ctrls, mats, reqs] = await Promise.all([
          getCollection('controls'),
          getCollection('materials'),
          getCollection('requisitions')
        ]);
        // Only active/incomplete controls
        const activeCtrls = ctrls.filter((c: any) => c.status === '處理中' || c.status === '缺料管制中');
        setControls(activeCtrls);
        setMaterials(mats);
        setRequisitions(reqs);
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const calculateDays = (control: any) => {
    const req = requisitions.find(r => r.id === control.requisitionId || r.displayId === control.requisitionId);
    if (!req || !req.returnDate) return 0;
    const start = parseISO(req.returnDate);
    const end = control.completionDate ? parseISO(control.completionDate) : new Date();
    return Math.max(0, differenceInDays(end, start));
  };

  const dayGroups = useMemo(() => {
    const groups = {
      '0天': 0,
      '1天': 0,
      '2天': 0,
      '3天': 0,
      '4天': 0,
      '5天': 0,
      '6天': 0,
      '7天以上': 0,
    };
    
    controls.forEach(c => {
      const days = calculateDays(c);
      if (days === 0) groups['0天']++;
      else if (days === 1) groups['1天']++;
      else if (days === 2) groups['2天']++;
      else if (days === 3) groups['3天']++;
      else if (days === 4) groups['4天']++;
      else if (days === 5) groups['5天']++;
      else if (days === 6) groups['6天']++;
      else groups['7天以上']++;
    });
    
    return groups;
  }, [controls, requisitions]);

  const getLegendColorClass = (days: number) => {
    if (days === 0) return 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800/50 dark:text-slate-300';
    if (days === 1) return 'bg-cyan-200 text-cyan-900 border-cyan-400 dark:bg-cyan-900/50 dark:text-cyan-300';
    if (days === 2) return 'bg-blue-200 text-blue-900 border-blue-400 dark:bg-blue-900/60 dark:text-blue-300';
    if (days === 3) return 'bg-lime-200 text-lime-800 border-lime-400 dark:bg-lime-900/60 dark:text-lime-300';
    if (days === 4) return 'bg-yellow-200 text-yellow-800 border-yellow-400 dark:bg-yellow-900/60 dark:text-yellow-300';
    if (days === 5) return 'bg-amber-200 text-amber-800 border-amber-400 dark:bg-amber-900/60 dark:text-amber-300';
    if (days === 6) return 'bg-orange-200 text-orange-800 border-orange-400 dark:bg-orange-900/60 dark:text-orange-300';
    return 'bg-red-500 text-white border-red-600 dark:bg-red-700 dark:text-white';
  };

  const getRowColorClass = (days: number) => {
    if (days === 0) return 'bg-slate-50/50 hover:bg-slate-100/50';
    if (days === 1) return 'bg-cyan-100/50 hover:bg-cyan-200/50 font-medium';
    if (days === 2) return 'bg-blue-100 hover:bg-blue-200 font-medium';
    if (days === 3) return 'bg-lime-100/50 hover:bg-lime-200/50';
    if (days === 4) return 'bg-yellow-100 hover:bg-yellow-200';
    if (days === 5) return 'bg-amber-100 hover:bg-amber-200';
    if (days === 6) return 'bg-orange-100 hover:bg-orange-200';
    return 'bg-red-100 hover:bg-red-200 text-red-900 font-bold';
  };

  const filteredControls = useMemo(() => {
    let result = controls;
    if (filterDay !== null) {
      result = result.filter(c => {
        const days = calculateDays(c);
        return filterDay === 7 ? days >= 7 : days === filterDay;
      });
    }
    if (filterCategory !== 'all') {
      result = result.filter(c => {
        return c.items.some((item: any) => {
          const mat = materials.find(m => m.id === item.materialId);
          return (mat?.category || '未分類') === filterCategory;
        });
      });
    }
    return result.sort((a, b) => calculateDays(b) - calculateDays(a));
  }, [controls, filterDay, requisitions]);

  const totalItems = filteredControls.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedControls = filteredControls.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-muted/30 p-4 rounded-xl border border-border/50">
        <div className="flex items-center gap-3">
          <AlarmClock className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight text-primary">稽催作業</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-muted-foreground">物料分類:</span>
          <select 
            className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium"
            value={filterCategory} 
            onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
          >
            <option value="all">全部分類</option>
            <option value="未分類">未分類</option>
            <option value="TKW">TKW</option>
            <option value="夾鉗">夾鉗</option>
          </select>
        </div>
      </div>

      <Card className="p-4 bg-muted/30">
        <div className="mb-2 font-bold text-lg">管制天數分組統計與圖例</div>
        <div className="flex flex-wrap gap-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map(d => {
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
                ? (filteredControls.reduce((sum, c) => sum + calculateDays(c), 0) / filteredControls.length).toFixed(2) 
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
                <TableHead>涵蓋物料分類</TableHead>
                <TableHead>管制天數</TableHead>
                <TableHead>缺料項目總數</TableHead>
                <TableHead>已補完數</TableHead>
                <TableHead>狀態</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center h-24">載入中...</TableCell>
                </TableRow>
              ) : paginatedControls.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center h-24">目前無符合天數的管制單</TableCell>
                </TableRow>
              ) : (
                paginatedControls.map((control, index) => {
                  const days = calculateDays(control);
                  const rowClass = getRowColorClass(days >= 7 ? 7 : days);
                  const cats = Array.from(new Set(control.items.map((i: any) => materials.find(m => m.id === i.materialId)?.category || '未分類')));
                  const req = requisitions.find(r => r.id === control.requisitionId || r.displayId === control.requisitionId);
                  const displayReqId = req ? (req.displayId || req.id) : control.requisitionId;
                  return (
                    <TableRow key={control.id} className={rowClass}>
                      <TableCell>{(page - 1) * pageSize + index + 1}</TableCell>
                      <TableCell className="font-bold">{control.displayId || control.id?.slice(0, 8)}</TableCell>
                      <TableCell className="text-muted-foreground">{displayReqId}</TableCell>
                      <TableCell>{cats.join(', ')}</TableCell>
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
      
      {!loading && paginatedControls.length > 0 && (
        <div className="flex justify-between items-center bg-muted/50 p-4 rounded-md mt-4">
          <div className="font-medium">總計: {totalItems} 筆管制單</div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm">每頁顯示:</span>
              <select 
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                value={pageSize} 
                onChange={(e) => { setPageSize(parseInt(e.target.value)); setPage(1); }}
              >
                <option value={10}>10 筆</option>
                <option value={20}>20 筆</option>
                <option value={30}>30 筆</option>
                <option value={50}>50 筆</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-2 py-1 border rounded hover:bg-muted disabled:opacity-50 text-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>上一頁</button>
              <span className="text-sm">第 {page} / {totalPages} 頁</span>
              <button className="px-2 py-1 border rounded hover:bg-muted disabled:opacity-50 text-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>下一頁</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
