import { useState, useEffect } from 'react';
import { getCollection, updateDocument, deleteDocument } from '@/lib/firebase/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { differenceInDays, parseISO, format } from 'date-fns';

export type ControlItem = {
  materialId: string;
  materialName: string;
  requiredQuantity: number;
  missingQuantity: number;
  restockDate: string;
  notes: string;
};

export type Control = {
  id?: string;
  displayId?: string;
  requisitionId: string;
  startDate: string;
  endDate: string | null;
  items: ControlItem[];
  status: '處理中' | '已結案';
  notes: string;
  completionDate?: string | null;
};

export default function ControlsPage() {
  const [controls, setControls] = useState<Control[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<Control | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [restockItemIndex, setRestockItemIndex] = useState<number | null>(null);
  const [enteredStock, setEnteredStock] = useState<string>('');
  const [restockDateStr, setRestockDateStr] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getCollection('controls') as Control[];
      const sortedData = data.sort((a, b) => (b.displayId || '').localeCompare(a.displayId || ''));
      setControls(sortedData);
    } catch (error) {
      console.error("Error loading controls:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleItemNoteChange = (index: number, value: string) => {
    if (!formData) return;
    const newItems = [...formData.items];
    newItems[index].notes = value;
    setFormData({ ...formData, items: newItems });
  };

  const handleItemDateChange = (index: number, value: string) => {
    if (!formData) return;
    const newItems = [...formData.items];
    newItems[index].restockDate = value;
    setFormData({ ...formData, items: newItems });
  };

  const handleDelete = async (id: string) => {
    // Optionally delete from firebase
    await deleteDocument('controls', id);
    setDeleteConfirmId(null);
    loadData();
  };

  const handleRestockClick = (index: number) => {
    const item = formData!.items[index];
    setRestockItemIndex(index);
    setRestockDateStr(item.restockDate || format(new Date(), 'yyyy-MM-dd'));
    setEnteredStock('');
  };

  const confirmRestock = async () => {
    if (restockItemIndex === null || !formData) return;
    const item = formData.items[restockItemIndex];
    const stockInput = parseInt(enteredStock);
    if (isNaN(stockInput) || stockInput < 0) {
      alert("請輸入有效的庫存數量");
      return;
    }

    try {
      // "自動扣除領料數：是 用管理者輸入的庫存數 - 該筆物料的領用數"
      const requiredQty = item.requiredQuantity || 0;
      const finalStock = stockInput - requiredQty;
      
      // Update inventory directly
      await updateDocument('materials', item.materialId, { stock: finalStock });

      // Update control item
      const newItems = [...formData.items];
      newItems[restockItemIndex] = {
        ...item,
        missingQuantity: 0,
        restockDate: restockDateStr
      };

      setFormData({ ...formData, items: newItems });
      setRestockItemIndex(null);
      alert(`已成功更新庫存，目前物料剩餘庫存: ${finalStock}`);
    } catch (error) {
      console.error("Error restocking:", error);
      alert("更新庫存失敗");
    }
  };

  const handleSave = async () => {
    if (!formData || !formData.id) return;
    
    try {
      let toSave = { ...formData };
      
      // Check if all items are restocked
      const allRestocked = toSave.items.every(i => i.missingQuantity === 0 && i.restockDate !== '');
      
      if (allRestocked) {
        toSave.status = '已結案';
        // find max restock date
        const dates = toSave.items.map(i => new Date(i.restockDate).getTime());
        const maxDate = new Date(Math.max(...dates));
        toSave.completionDate = format(maxDate, 'yyyy-MM-dd');
        toSave.endDate = toSave.completionDate;
      }

      await updateDocument('controls', formData.id, toSave);
      
      if (allRestocked && toSave.requisitionId) {
        await updateDocument('requisitions', toSave.requisitionId, {
          status: '已完成',
          completionDate: toSave.completionDate
        });
      }

      setIsOpen(false);
      loadData();
    } catch (error) {
      console.error("Error saving control:", error);
    }
  };

  const calculateDays = (startDate: string, endDate: string | null) => {
    if (!startDate) return 0;
    const start = parseISO(startDate);
    const end = endDate ? parseISO(endDate) : new Date();
    return Math.max(0, differenceInDays(end, start));
  };

  const totalItems = controls.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedData = controls.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認刪除</DialogTitle>
          </DialogHeader>
          <div className="py-4">您確定要刪除此管制單嗎？此動作無法復原。</div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>取消</Button>
            <Button variant="destructive" onClick={() => { if(deleteConfirmId) handleDelete(deleteConfirmId); }}>確認刪除</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-primary">物料管制</h1>
      </div>

      <Dialog open={restockItemIndex !== null} onOpenChange={(open) => !open && setRestockItemIndex(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>設定補完日期與進貨庫存</DialogTitle>
          </DialogHeader>
          {restockItemIndex !== null && formData && (
            <div className="space-y-4 py-4">
              <div className="text-sm font-medium text-primary">
                物料品號: {formData.items[restockItemIndex].materialName}
              </div>
              <div className="text-sm text-muted-foreground">
                原需領用數: {formData.items[restockItemIndex].requiredQuantity}
              </div>
              <div className="space-y-2">
                <Label>補完日期</Label>
                <Input 
                  type="date" 
                  value={restockDateStr} 
                  onChange={(e) => setRestockDateStr(e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <Label>當下進貨量 (包含原庫存的總量)</Label>
                <Input 
                  type="number" 
                  value={enteredStock} 
                  onChange={(e) => setEnteredStock(e.target.value)} 
                  placeholder="輸入總庫存"
                />
                <div className="text-xs text-muted-foreground mt-1">
                  系統將會用這個數字減去該筆物料的領用數，成為最終的庫存數量。
                </div>
              </div>
              <Button className="w-full" onClick={confirmRestock}>確認補完並更新庫存</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>編輯物料管制單 ({formData?.displayId || formData?.id?.slice(0,8)})</DialogTitle>
          </DialogHeader>
          {formData && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>關聯領料單號</Label>
                  <div className="flex h-10 w-full items-center px-3 rounded-md border border-input bg-muted/50">
                    {formData.requisitionId.startsWith('領') ? formData.requisitionId : formData.requisitionId.slice(0, 8)}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>狀態</Label>
                  <div className="flex h-10 w-full items-center px-3 rounded-md border border-input bg-muted/50 font-bold">
                    {formData.status}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>管制開始日期</Label>
                  <div className="flex h-10 w-full items-center px-3 rounded-md border border-input bg-muted/50">
                    {formData.startDate}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>整體備註</Label>
                  <Input 
                    value={formData.notes || ''} 
                    onChange={(e) => setFormData({...formData, notes: e.target.value})} 
                    placeholder="如: 廠商延遲交貨"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-lg">缺料項目清單</Label>
                {formData.items.map((item, index) => (
                  <Card key={index} className="bg-muted/30">
                    <CardContent className="p-4 grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-3 space-y-1">
                        <Label className="text-xs text-muted-foreground">物料品號</Label>
                        <div className="font-medium">{item.materialName}</div>
                        <div className="text-xs text-muted-foreground">需領: {item.requiredQuantity || 0}</div>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs text-muted-foreground">缺件狀態</Label>
                        {item.missingQuantity > 0 ? (
                          <div className="font-bold text-destructive">缺 {item.missingQuantity}</div>
                        ) : (
                          <div className="font-bold text-green-600">已補完</div>
                        )}
                      </div>
                      <div className="col-span-3 space-y-1">
                        <Label className="text-xs">補完日期</Label>
                        {item.restockDate ? (
                          <Input 
                            type="date"
                            value={item.restockDate}
                            onChange={(e) => handleItemDateChange(index, e.target.value)}
                            className="text-green-600 font-bold bg-green-50"
                          />
                        ) : (
                          <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => handleRestockClick(index)}>
                            設定補完日期
                          </Button>
                        )}
                      </div>
                      <div className="col-span-4 space-y-1">
                        <Label className="text-xs">後續處理情況/備註</Label>
                        <Input 
                          value={item.notes} 
                          onChange={(e) => handleItemNoteChange(index, e.target.value)}
                          placeholder="進度說明..."
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="pt-4 flex justify-end border-t">
                <Button onClick={handleSave}>儲存更新</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex justify-between items-center bg-muted/50 p-4 rounded-md">
        <div className="font-medium">總計: {totalItems} 筆管制單</div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label>每頁顯示:</Label>
            <Select value={pageSize.toString()} onValueChange={(val) => { setPageSize(parseInt(val)); setPage(1); }}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 筆</SelectItem>
                <SelectItem value="20">20 筆</SelectItem>
                <SelectItem value="30">30 筆</SelectItem>
                <SelectItem value="50">50 筆</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>上一頁</Button>
            <span className="text-sm">第 {page} / {totalPages} 頁</span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>下一頁</Button>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">操作</TableHead>
                <TableHead className="w-16">序號</TableHead>
                <TableHead>管制單號</TableHead>
                <TableHead>關聯領料單</TableHead>
                <TableHead>管制天數</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>完成日期</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24">載入中...</TableCell>
                </TableRow>
              ) : paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24">目前尚無管制單</TableCell>
                </TableRow>
              ) : (
                paginatedData.map((control, index) => (
                  <TableRow key={control.id}>
                    <TableCell>
                      <div className="flex flex-row gap-2">
                        <Button variant="outline" size="sm" onClick={() => {
                          setFormData(control);
                          setIsOpen(true);
                        }}>處理檢視</Button>
                        <Button variant="destructive" size="sm" onClick={() => setDeleteConfirmId(control.id!)}>刪除</Button>
                      </div>
                    </TableCell>
                    <TableCell>{(page - 1) * pageSize + index + 1}</TableCell>
                    <TableCell className="font-bold">{control.displayId || control.id?.slice(0, 8)}</TableCell>
                    <TableCell className="text-muted-foreground">{control.requisitionId.startsWith('領') ? control.requisitionId : control.requisitionId.slice(0, 8)}</TableCell>
                    <TableCell>
                      <div className={`font-bold ${calculateDays(control.startDate, control.completionDate || null) > 7 ? 'text-destructive' : ''}`}>
                        {calculateDays(control.startDate, control.completionDate || null)} 天
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={control.status === '已結案' ? 'default' : 'secondary'} className={control.status === '處理中' ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}>
                        {control.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{control.completionDate || '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
