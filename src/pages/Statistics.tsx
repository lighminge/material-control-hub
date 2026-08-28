import { useState, useEffect, useMemo, useRef } from 'react';
import { getCollection } from '@/lib/firebase/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { calculateWorkingDays } from '@/utils/dateUtils';
import { ClipboardList, ShieldAlert, TrendingUp, PieChart } from 'lucide-react';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, LabelList, PieChart as RechartsPieChart, Pie, Cell, Legend } from 'recharts';
import * as XLSX from 'xlsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import html2canvas from 'html2canvas';
export default function StatisticsPage() {
  const [controls, setControls] = useState<any[]>([]);
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [returnDateStart, setReturnDateStart] = useState('');
  const [returnDateEnd, setReturnDateEnd] = useState('');
  const [category, setCategory] = useState('all');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'both'>('bar');
  const [selectedPieSlice, setSelectedPieSlice] = useState<string | null>(null);
  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(10);
  const [useYearFilter, setUseYearFilter] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  const [staffList, setStaffList] = useState<any[]>([]);
  const [defects, setDefects] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterUser, setFilterUser] = useState('all');

  useEffect(() => {
    const loadData = async () => {
      try {
        const [ctrls, reqs, mats, holsData, usersData, defectsData] = await Promise.all([
          getCollection('controls'),
          getCollection('requisitions'),
          getCollection('materials'),
          getCollection('holidays'),
          getCollection('staff'),
          getCollection('defects')
        ]);
        setControls(ctrls);
        setRequisitions(reqs);
        setMaterials(mats);
        setHolidays(holsData);
        setStaffList(usersData);
        setDefects(defectsData);
      } catch (error) {
        console.error("Error loading data:", error);
      }
    };
    loadData();
  }, []);

  const calculateDays = (control: any, reqs: any[], hols: any[]) => {
    const req = reqs.find((r: any) => r.id === control.requisitionId || r.displayId === control.requisitionId);
    if (!req || !req.returnDate) return 0;
    return calculateWorkingDays(req.returnDate, control.completionDate, hols);
  };

  const defectiveStats = useMemo(() => {
    const isWithinRange = (dateStr: string) => {
      if (!dateStr) return false;
      const d = parseISO(dateStr);
      if (isNaN(d.getTime())) return false;
      if (useYearFilter && selectedYear) {
        if (d.getFullYear().toString() !== selectedYear) return false;
      }
      if (startDate && isBefore(d, startOfDay(parseISO(startDate)))) return false;
      if (endDate && isAfter(d, endOfDay(parseISO(endDate)))) return false;
      return true;
    };

    const filteredDefects = defects.filter(d => {
      if (d.date && !isWithinRange(d.date)) return false;
      return true;
    });

    const uniqueForms = new Set(filteredDefects.map(d => d.formId));

    return {
      formsCount: uniqueForms.size,
      itemsCount: filteredDefects.length
    };
  }, [defects, startDate, endDate, useYearFilter, selectedYear]);

  const stats = useMemo(() => {
    // Helper to check date range
    const isWithinRange = (dateStr: string) => {
      if (!dateStr) return false;
      const d = parseISO(dateStr);
      if (isNaN(d.getTime())) return false;
      if (useYearFilter && selectedYear) {
        if (d.getFullYear().toString() !== selectedYear) return false;
      }
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
      
      if (returnDateStart || returnDateEnd) {
        if (!req.returnDate) return false;
        const d = parseISO(req.returnDate);
        if (!isNaN(d.getTime())) {
          if (returnDateStart && isBefore(d, startOfDay(parseISO(returnDateStart)))) return false;
          if (returnDateEnd && isAfter(d, endOfDay(parseISO(returnDateEnd)))) return false;
        } else {
          return false;
        }
      }
      
      // category filter
      if (category !== 'all' && (req.category || '未分類') !== category) return false;
      
      return true;
    });

    // Filter Controls
    const filteredControls = controls.filter(ctrl => {
      if (!isWithinRange(ctrl.startDate)) return false;
      
      if (returnDateStart || returnDateEnd) {
        const req = requisitions.find((r: any) => r.id === ctrl.requisitionId || r.displayId === ctrl.requisitionId);
        if (!req || !req.returnDate) return false;
        const d = parseISO(req.returnDate);
        if (!isNaN(d.getTime())) {
          if (returnDateStart && isBefore(d, startOfDay(parseISO(returnDateStart)))) return false;
          if (returnDateEnd && isAfter(d, endOfDay(parseISO(returnDateEnd)))) return false;
        } else {
          return false;
        }
      }
      
      if (category !== 'all') {
        // Check if any item in the control matches the category
        const hasCategory = (ctrl.items || []).some((item: any) => {
          const mat = materials.find(m => m.id === item.materialId);
          return (mat?.category || '未分類') === category;
        });
        if (!hasCategory) return false;
      }
      
      if (filterStatus !== 'all' && ctrl.status !== filterStatus) {
        return false;
      }

      if (filterUser !== 'all') {
        const req = requisitions.find((r: any) => r.id === ctrl.requisitionId || r.displayId === ctrl.requisitionId);
        if (!req || req.staffId !== filterUser) {
          return false;
        }
      }
      
      return true;
    });

    let totalDays = 0;
    const counts = Array(8).fill(0);
    
    filteredControls.forEach(c => {
      const d = calculateDays(c, requisitions, holidays);
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
      daysData,
      pieData: daysData.filter(d => d.數量 > 0).map(d => ({ name: d.name, value: d.數量 })),
      filteredControls
    };
  }, [controls, requisitions, materials, startDate, endDate, returnDateStart, returnDateEnd, category, useYearFilter, selectedYear, filterStatus, filterUser]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#a4de6c', '#d0ed57', '#8884d8', '#8dd1e1'];

  const selectedControls = useMemo(() => {
    if (!selectedPieSlice) return [];
    return stats.filteredControls.filter(c => {
      const d = calculateDays(c, requisitions, holidays);
      const dayLabel = d >= 7 ? '7天以上' : `${d}天`;
      return dayLabel === selectedPieSlice;
    });
  }, [stats.filteredControls, selectedPieSlice, requisitions, holidays]);

  const listTotalPages = Math.ceil(selectedControls.length / listPageSize) || 1;
  const paginatedList = selectedControls.slice((listPage - 1) * listPageSize, listPage * listPageSize);

  const pieChartRef = useRef<HTMLDivElement>(null);
  const barChartRef = useRef<HTMLDivElement>(null);

  const handleExportImage = async () => {
    if (pieChartRef.current) {
      try {
        const canvas = await html2canvas(pieChartRef.current, { backgroundColor: '#ffffff' });
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `管制天數佔比_${new Date().toISOString().slice(0,10)}.png`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error('Failed to export image', err);
      }
    }
  };

  const handleExportBarImage = async () => {
    if (barChartRef.current) {
      try {
        const canvas = await html2canvas(barChartRef.current, { backgroundColor: '#ffffff' });
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `管制天數分佈圖_${new Date().toISOString().slice(0,10)}.png`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error('Failed to export bar chart image', err);
      }
    }
  };

  const handleExportExcel = () => {
    // We want to export stats.daysData + basic stats
    const basicStats = [
      { '項目': '總領料單數', '數值': stats.reqCount },
      { '項目': '總管制單數', '數值': stats.ctrlCount },
      { '項目': '平均管制天數', '數值': stats.avgDays }
    ];
    
    const daysStats = stats.daysData.map(d => ({
      '天數群組': d.name,
      '數量': d.數量,
      '佔比': stats.ctrlCount > 0 ? ((d.數量 / stats.ctrlCount) * 100).toFixed(1) + '%' : '0%'
    }));
    
    const sortedControls = [...stats.filteredControls].sort((a, b) => {
      const dA = calculateDays(a, requisitions, holidays);
      const dB = calculateDays(b, requisitions, holidays);
      return dA - dB;
    });

    let completedCount = 0;
    let processingCount = 0;

    const detailsStats: any[] = sortedControls.map((c, index) => {
      const req = requisitions.find((r: any) => r.id === c.requisitionId || r.displayId === c.requisitionId);
      const displayReqId = req ? (req.displayId || req.id) : c.requisitionId;
      const d = calculateDays(c, requisitions, holidays);
      const dayLabel = d >= 7 ? '7天以上' : `${d}天`;
      
      if (c.status === '已結案') completedCount++;
      else processingCount++;

      return {
        '序號': index + 1,
        '天數群組': dayLabel,
        '管制單號': c.displayId || c.id?.slice(0, 8),
        '關聯領料單': displayReqId,
        '狀態': c.status,
        '領料單繳回日': req?.returnDate || '-',
        '完成日期': c.completionDate || '-',
        '管制天數': d
      };
    });

    detailsStats.push({});
    detailsStats.push({
      '序號': '總計',
      '天數群組': `總筆數: ${sortedControls.length}`,
      '管制單號': `平均日數: ${stats.avgDays}`,
      '關聯領料單': `已結案: ${completedCount}`,
      '狀態': `處理中: ${processingCount}`
    });
    
    const wb = XLSX.utils.book_new();
    
    const wsBasic = XLSX.utils.json_to_sheet(basicStats);
    XLSX.utils.book_append_sheet(wb, wsBasic, "基本統計");
    
    const wsDays = XLSX.utils.json_to_sheet(daysStats);
    XLSX.utils.book_append_sheet(wb, wsDays, "天數統計");

    const wsDetails = XLSX.utils.json_to_sheet(detailsStats);
    XLSX.utils.book_append_sheet(wb, wsDetails, "管制清單明細");
    
    XLSX.writeFile(wb, `統計資料_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <Tabs defaultValue="material" className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center bg-muted/30 p-4 rounded-xl border border-border/50 gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <PieChart className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight text-primary">統計作業</h1>
          </div>
          <TabsList className="self-start">
            <TabsTrigger value="material">物料管制統計</TabsTrigger>
            <TabsTrigger value="defective">不良品統計</TabsTrigger>
          </TabsList>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 ml-auto">
          <div className="flex items-center gap-3 bg-white px-4 py-1.5 rounded-lg shadow-sm border border-border/50 h-[40px]">
            <div className="flex items-center space-x-2">
              <Checkbox id="filter-year" checked={useYearFilter} onCheckedChange={(c) => setUseYearFilter(!!c)} />
              <label htmlFor="filter-year" className="text-sm font-medium leading-none cursor-pointer text-muted-foreground whitespace-nowrap">
                以年度區分
              </label>
            </div>
            {useYearFilter && (
              <div className="border-l pl-3 ml-1">
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-[90px] h-7 text-sm">
                    <SelectValue placeholder="年度" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2026">2026</SelectItem>
                    <SelectItem value="2027">2027</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <Button onClick={handleExportExcel} className="bg-green-600 hover:bg-green-700 text-white font-bold h-[40px]">
            匯出 Excel
          </Button>
        </div>
      </div>
      <TabsContent value="material" className="space-y-6">
      <Card className="mb-6 shadow-sm border-t-4 border-t-blue-500">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          <div className="space-y-2">
            <Label>管制開始日期 (起)</Label>
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
            <Label>管制開始日期 (迄)</Label>
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
            <Label>領料單繳回日期 (起)</Label>
            <Input 
              type="date" 
              value={returnDateStart} 
              onChange={(e) => setReturnDateStart(e.target.value)} 
              style={{ colorScheme: 'light dark' }}
              onClick={(e) => {
                const target = e.target as HTMLInputElement;
                if (target.showPicker) target.showPicker();
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>領料單繳回日期 (迄)</Label>
            <Input 
              type="date" 
              value={returnDateEnd} 
              onChange={(e) => setReturnDateEnd(e.target.value)} 
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
          <div className="space-y-2">
            <Label>狀態</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="全部狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部狀態</SelectItem>
                <SelectItem value="處理中">處理中</SelectItem>
                <SelectItem value="已結案">已結案</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>備料人員</Label>
            <Select value={filterUser} onValueChange={setFilterUser}>
              <SelectTrigger>
                <SelectValue placeholder="全部人員" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部人員</SelectItem>
                {staffList.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
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
      
      <Card className="flex flex-col" ref={barChartRef}>
        <CardHeader className="flex flex-row items-start justify-between pb-2">
          <div>
            <CardTitle>管制天數分佈圖</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">符合查詢條件之管制單處理時長</p>
          </div>
          <div className="flex items-center gap-2">
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
            <Button onClick={handleExportBarImage} variant="outline" className="h-8 text-xs font-bold border-primary text-primary">
              匯出圖檔
            </Button>
          </div>
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

      <Card className="flex flex-col mb-10">
        <CardHeader className="flex flex-row items-start justify-between pb-2">
          <div>
            <CardTitle>管制天數佔比</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">各管制天數在總單量中的百分比</p>
          </div>
          <Button onClick={handleExportImage} variant="outline" className="font-bold border-primary text-primary">
            匯出圖檔
          </Button>
        </CardHeader>
        <CardContent>
          <div ref={pieChartRef} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center bg-card p-4 rounded-xl">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={stats.pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={0}
                    dataKey="value"
                    stroke="white"
                    strokeWidth={1}
                    isAnimationActive={false}
                    label={({ name, percent, value }) => `${name} ${((percent || 0) * 100).toFixed(0)}% (${value}筆)`}
                  >
                    {stats.pieData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[index % COLORS.length]} 
                        onClick={() => { setSelectedPieSlice(selectedPieSlice === entry.name ? null : entry.name); setListPage(1); }}
                        style={{ cursor: 'pointer' }}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-4">
              <h3 className="font-bold text-lg mb-4">數據總覽</h3>
              <div className="space-y-2">
                {stats.daysData.map((d, i) => (
                  <div 
                    key={d.name} 
                    className={`flex items-center gap-6 text-sm border-b pb-2 cursor-pointer hover:bg-muted/50 p-2 rounded ${selectedPieSlice === d.name ? 'bg-muted' : ''}`}
                    onClick={() => { setSelectedPieSlice(selectedPieSlice === d.name ? null : d.name); setListPage(1); }}
                  >
                    <div className="flex items-center gap-2 w-20">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                      <span>{d.name}</span>
                    </div>
                    <div className="font-bold w-16 text-right">{d.數量} 筆</div>
                    <div className="text-muted-foreground w-16 text-right">
                      {stats.ctrlCount > 0 ? ((d.數量 / stats.ctrlCount) * 100).toFixed(1) : 0}%
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-6 text-sm border-t-2 pt-2 mt-2">
                  <div className="flex items-center gap-2 w-20">
                    <span className="font-bold">總計</span>
                  </div>
                  <div className="font-bold w-16 text-right">{stats.ctrlCount} 筆</div>
                  <div className="text-muted-foreground w-16 text-right">
                    {stats.ctrlCount > 0 ? '100.0%' : '0%'}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {selectedPieSlice && (
            <div className="mt-8 border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-primary">
                    {selectedPieSlice} 管制單清單
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">共 {selectedControls.length} 筆資料</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedPieSlice(null)}>關閉清單</Button>
                </div>
              </div>
              
              <div className="flex justify-between items-center bg-muted/30 p-2 rounded-md mb-2">
                <div className="flex items-center gap-2 text-sm">
                  <Label>每頁顯示:</Label>
                  <Select value={listPageSize.toString()} onValueChange={(val) => { setListPageSize(parseInt(val)); setListPage(1); }}>
                    <SelectTrigger className="w-[80px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 筆</SelectItem>
                      <SelectItem value="20">20 筆</SelectItem>
                      <SelectItem value="30">30 筆</SelectItem>
                      <SelectItem value="40">40 筆</SelectItem>
                      <SelectItem value="50">50 筆</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setListPage(p => Math.max(1, p - 1))} disabled={listPage === 1}>上一頁</Button>
                  <span className="text-sm">第 {listPage} / {listTotalPages} 頁</span>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setListPage(p => Math.min(listTotalPages, p + 1))} disabled={listPage === listTotalPages}>下一頁</Button>
                </div>
              </div>

              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-16">序號</TableHead>
                      <TableHead>管制單號</TableHead>
                      <TableHead>關聯領料單</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead>領料單繳回日</TableHead>
                      <TableHead>完成日期</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">無管制單</TableCell>
                      </TableRow>
                    ) : (
                      paginatedList.map((c, index) => {
                        const req = requisitions.find((r: any) => r.id === c.requisitionId || r.displayId === c.requisitionId);
                        const displayReqId = req ? (req.displayId || req.id) : c.requisitionId;
                        return (
                          <TableRow key={c.id}>
                            <TableCell>{(listPage - 1) * listPageSize + index + 1}</TableCell>
                            <TableCell className="font-bold">{c.displayId || c.id?.slice(0, 8)}</TableCell>
                            <TableCell className="text-muted-foreground">{displayReqId}</TableCell>
                            <TableCell>{c.status}</TableCell>
                            <TableCell>{req?.returnDate || '-'}</TableCell>
                            <TableCell>{c.completionDate || '-'}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </TabsContent>
      
      <TabsContent value="defective" className="space-y-6">
        <Card className="mb-6 shadow-sm border-t-4 border-t-red-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-bold">查詢條件設定</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>建單日期(起)</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} onClick={(e: any) => e.target.showPicker?.()} disabled={useYearFilter} />
            </div>
            <div className="space-y-2">
              <Label>建單日期(迄)</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} onClick={(e: any) => e.target.showPicker?.()} disabled={useYearFilter} />
            </div>
          </CardContent>
        </Card>
        
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">符合條件的不良品單數量</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-primary">{defectiveStats.formsCount}</div>
              <p className="text-xs text-muted-foreground mt-2">表單總數</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">符合條件的不良品項目數量</CardTitle>
              <ShieldAlert className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-destructive">{defectiveStats.itemsCount}</div>
              <p className="text-xs text-muted-foreground mt-2">各項不良物料加總</p>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  );
}
