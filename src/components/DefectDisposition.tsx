import { useState, useEffect, useMemo } from 'react';
import { getCollection, updateDocument } from '@/lib/firebase/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import type { Defect } from '@/pages/Defective';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const DISPOSITION_METHODS = ['廠內報廢', '廠內重工', '廠商重工', '退廠商扣款', '轉測試用料'] as const;
type DispositionMethod = typeof DISPOSITION_METHODS[number];

const parseTime = (val: any) => {
  if (!val) return 0;
  if (typeof val.toMillis === 'function') return val.toMillis();
  if (val.seconds) return val.seconds * 1000;
  const t = new Date(val).getTime();
  return isNaN(t) ? 0 : t;
};

export default function DefectDisposition() {
  const [defects, setDefects] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'));
  const [search, setSearch] = useState('');
  
  // Sorting: 'date_asc', 'date_desc', 'part_asc', 'part_desc'
  const [sortBy, setSortBy] = useState('date_asc');
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processQuantity, setProcessQuantity] = useState('');
  
  // New states
  const [systemAlert, setSystemAlert] = useState<string | null>(null);
  const [editDisp, setEditDisp] = useState<{defectId: string, index: number, method: DispositionMethod, quantity: number, maxQty: number} | null>(null);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [search, year, month]);

  const loadData = async () => {
    setLoading(true);
    try {
      const defectsData = await getCollection('defects');
      setDefects(defectsData as Defect[]);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredDefects = useMemo(() => {
    return defects.filter(d => {
      const matchMonth = d.date?.startsWith(`${year}-${month}`);
      if (!matchMonth) return false;
      if (search) {
        const s = search.toLowerCase();
        return (d.materialId?.toLowerCase().includes(s) || d.materialName?.toLowerCase().includes(s));
      }
      return true;
    });
  }, [defects, year, month, search]);

  const groupedDefects = useMemo(() => {
    // Group by materialId
    const groups = new Map<string, Defect[]>();
    filteredDefects.forEach(d => {
      const key = d.materialId || 'Unknown';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(d);
    });

    const groupArray = Array.from(groups.entries()).map(([materialId, items]) => ({
      materialId,
      materialName: items[0]?.materialName || '',
      items: items.sort((a, b) => {
        // Inner sort by date
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return parseTime(a.createdAt) - parseTime(b.createdAt);
      })
    }));

    // Sort groups
    groupArray.sort((a, b) => {
      if (sortBy === 'date_asc') {
        return new Date(a.items[0].date).getTime() - new Date(b.items[0].date).getTime();
      } else if (sortBy === 'date_desc') {
        return new Date(b.items[0].date).getTime() - new Date(a.items[0].date).getTime();
      } else if (sortBy === 'part_asc') {
        return a.materialId.localeCompare(b.materialId);
      } else {
        return b.materialId.localeCompare(a.materialId);
      }
    });

    return groupArray;
  }, [filteredDefects, sortBy]);

  const getRemainingQty = (d: Defect) => {
    const total = Number(d.quantity) || 0;
    const processed = d.dispositions?.reduce((sum, disp) => sum + disp.quantity, 0) || 0;
    return total - processed;
  };

  const selectedItems = useMemo(() => {
    return filteredDefects.filter(d => d.id && selectedIds.has(d.id));
  }, [filteredDefects, selectedIds]);

  const totalSelectedRemaining = useMemo(() => {
    return selectedItems.reduce((sum, d) => sum + getRemainingQty(d), 0);
  }, [selectedItems]);

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleProcess = async (method: DispositionMethod) => {
    const qtyToProcess = parseInt(processQuantity, 10);
    if (isNaN(qtyToProcess) || qtyToProcess <= 0) {
      setSystemAlert('請輸入有效數量');
      return;
    }
    if (qtyToProcess > totalSelectedRemaining) {
      setSystemAlert(`輸入數量 (${qtyToProcess}) 大於選取項目的可處理數量 (${totalSelectedRemaining})`);
      return;
    }

    // Sort selected items by date asc (oldest first)
    const itemsToProcess = [...selectedItems].sort((a, b) => {
      const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return parseTime(a.createdAt) - parseTime(b.createdAt);
    });

    let remainingToProcess = qtyToProcess;
    
    setLoading(true);
    try {
      for (const item of itemsToProcess) {
        if (remainingToProcess <= 0) break;
        if (!item.id) continue;

        const itemRemaining = getRemainingQty(item);
        if (itemRemaining <= 0) continue;

        const processForThisItem = Math.min(itemRemaining, remainingToProcess);
        remainingToProcess -= processForThisItem;

        const newDisposition = {
          method,
          quantity: processForThisItem,
          timestamp: new Date().toISOString()
        };

        const updatedDispositions = [...(item.dispositions || []), newDisposition];
        await updateDocument('defects', item.id, {
          dispositions: updatedDispositions
        });
      }
      
      setSystemAlert('處理完成');
      setProcessQuantity('');
      setSelectedIds(new Set());
      await loadData();
    } catch (err) {
      console.error(err);
      setSystemAlert('處理失敗，請重試');
    }
    setLoading(false);
  };

  const handleSaveEdit = async () => {
    if (!editDisp) return;
    const { defectId, index, method, quantity } = editDisp;
    const defect = defects.find(d => d.id === defectId);
    if (!defect || !defect.dispositions) return;

    if (quantity <= 0) {
      setSystemAlert('數量必須大於 0');
      return;
    }

    setLoading(true);
    try {
      const updatedDispositions = [...defect.dispositions];
      updatedDispositions[index] = {
        ...updatedDispositions[index],
        method,
        quantity
      };
      await updateDocument('defects', defectId, { dispositions: updatedDispositions });
      setEditDisp(null);
      await loadData();
    } catch (err) {
      console.error(err);
      setSystemAlert('修改失敗，請重試');
    }
    setLoading(false);
  };

  const handleDeleteDisp = async (defectId: string, index: number) => {
    const defect = defects.find(d => d.id === defectId);
    if (!defect || !defect.dispositions) return;
    
    setLoading(true);
    try {
      const updatedDispositions = [...defect.dispositions];
      updatedDispositions.splice(index, 1);
      await updateDocument('defects', defectId, { dispositions: updatedDispositions });
      setEditDisp(null);
      await loadData();
    } catch (err) {
      console.error(err);
      setSystemAlert('刪除失敗，請重試');
    }
    setLoading(false);
  };

  if (loading && defects.length === 0) return <div>載入中...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <span className="text-sm font-medium">年份</span>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map(y => (
                    <SelectItem key={y} value={y.toString()}>{y}年</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1">
              <span className="text-sm font-medium">月份</span>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({length: 12}, (_, i) => (i + 1).toString().padStart(2, '0')).map(m => (
                    <SelectItem key={m} value={m}>{m}月</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <span className="text-sm font-medium">排序</span>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="date_asc">日期 (小到大)</SelectItem>
                  <SelectItem value="date_desc">日期 (大到小)</SelectItem>
                  <SelectItem value="part_asc">品號 (A到Z)</SelectItem>
                  <SelectItem value="part_desc">品號 (Z到A)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 flex-1 min-w-[200px]">
              <span className="text-sm font-medium">關鍵字搜尋 (品名/品號)</span>
              <Input 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                placeholder="輸入物料名稱或品號" 
              />
            </div>
            
            <div className="bg-slate-50 p-2 px-4 rounded-md border text-sm flex items-center h-[40px]">
              統計筆數：<span className="font-bold text-blue-600 ml-1">{filteredDefects.length}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" /> 批次處置作業
        </h3>
        <div className="flex flex-wrap items-center gap-4">
          <div className="text-sm">
            已選 <span className="font-bold text-lg">{selectedIds.size}</span> 項，
            可處理總數：<span className="font-bold text-lg text-blue-600">{totalSelectedRemaining}</span>
          </div>
          <Input 
            type="number"
            className="w-32 bg-white" 
            placeholder="輸入處理數量" 
            value={processQuantity}
            onChange={e => setProcessQuantity(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {DISPOSITION_METHODS.map(m => (
              <Button 
                key={m} 
                variant="default" 
                className="bg-blue-600 hover:bg-blue-700 text-xs shadow-sm"
                onClick={() => handleProcess(m)}
                disabled={!selectedIds.size || !processQuantity || parseInt(processQuantity, 10) <= 0}
              >
                {m}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {groupedDefects.map(group => (
          <div key={group.materialId} className="border-l-4 border-slate-300 pl-4 py-2">
            <h4 className="text-lg font-bold mb-3 flex items-center gap-2">
              <span className="text-blue-600">{group.materialId}</span>
              <span className="text-rose-600 font-extrabold text-xl ml-2">{group.materialName}</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {group.items.map((item, index) => {
                const rem = getRemainingQty(item);
                const isSelected = item.id ? selectedIds.has(item.id) : false;
                
                return (
                  <Card 
                    key={item.id} 
                    className={`cursor-pointer transition-all border-2 ${isSelected ? 'border-blue-500 bg-blue-50/30' : 'border-transparent'} hover:border-blue-300 shadow-sm`}
                    onClick={() => item.id && rem > 0 && toggleSelect(item.id)}
                  >
                    <CardHeader className="py-2 px-3 bg-slate-50 border-b flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          checked={isSelected}
                          onCheckedChange={() => item.id && rem > 0 && toggleSelect(item.id)}
                          disabled={rem <= 0}
                        />
                        <span className="text-xs font-bold text-slate-500">#{index + 1}</span>
                      </div>
                      <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border">{item.date}</span>
                    </CardHeader>
                    <CardContent className="p-3 text-sm space-y-2 relative">
                      {rem <= 0 && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-b-lg">
                          <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> 已處理完畢
                          </Badge>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                        <span className="text-slate-500">頭型</span>
                        <span>{item.headType || '-'}</span>
                      </div>
                      <div className="mt-2">
                        <span className="text-slate-500 text-xs">不良情況</span>
                        <div className="break-words whitespace-pre-wrap text-sm leading-tight mt-0.5">{item.condition || '-'}</div>
                      </div>
                      
                      <div className="bg-slate-50 p-2 rounded border mt-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium text-slate-700">總不良數</span>
                          <span className="font-bold">{item.quantity}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-blue-700">待處理</span>
                          <span className="font-bold text-blue-600 text-lg">{rem}</span>
                        </div>
                      </div>

                      {(item.dispositions || []).length > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="text-xs text-slate-500 font-medium border-b pb-1 mb-1">處理明細</div>
                          {item.dispositions!.map((disp, i) => {
                            // Calculate max allowed qty for editing
                            const otherDispSum = item.dispositions!.reduce((sum, d, idx) => idx === i ? sum : sum + d.quantity, 0);
                            const maxQty = (Number(item.quantity) || 0) - otherDispSum;
                            return (
                              <div key={i} className="flex justify-between text-xs items-center group">
                                <Badge variant="outline" className="text-[10px] py-0">{disp.method}</Badge>
                                <div className="flex items-center gap-1">
                                  <span className="font-mono text-slate-600">{disp.quantity} PCS</span>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditDisp({ defectId: item.id!, index: i, method: disp.method as DispositionMethod, quantity: disp.quantity, maxQty });
                                    }}
                                  >
                                    <Pencil className="w-3 h-3 text-blue-500" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
        
        {groupedDefects.length === 0 && (
          <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-dashed">
            沒有符合條件的不良品資料
          </div>
        )}
      </div>
      <Dialog open={!!systemAlert} onOpenChange={(open) => !open && setSystemAlert(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>系統提示</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-slate-700">
            {systemAlert}
          </div>
          <DialogFooter>
            <Button onClick={() => setSystemAlert(null)}>確定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editDisp} onOpenChange={(open) => !open && setEditDisp(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>修改處理狀態</DialogTitle>
          </DialogHeader>
          {editDisp && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <span className="text-sm font-medium">處理方式</span>
                <Select value={editDisp.method} onValueChange={(val) => setEditDisp({...editDisp, method: val as DispositionMethod})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DISPOSITION_METHODS.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium">數量 (最大可輸入: {editDisp.maxQty})</span>
                <Input 
                  type="number" 
                  value={editDisp.quantity} 
                  onChange={e => {
                    let val = parseInt(e.target.value, 10);
                    if (isNaN(val)) val = 0;
                    if (val > editDisp.maxQty) val = editDisp.maxQty;
                    setEditDisp({...editDisp, quantity: val});
                  }} 
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex justify-between items-center w-full sm:justify-between">
            <Button variant="destructive" size="icon" onClick={() => editDisp && handleDeleteDisp(editDisp.defectId, editDisp.index)}>
              <Trash2 className="w-4 h-4" />
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditDisp(null)}>取消</Button>
              <Button onClick={handleSaveEdit}>儲存修改</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
