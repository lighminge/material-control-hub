import { useState, useEffect } from 'react';
import { getCollection, updateDocument, deleteDocument, setDocumentWithId } from '@/lib/firebase/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Trash2, Pencil } from 'lucide-react';
import { calculateWorkingDays } from '@/utils/dateUtils';

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
  const [materials, setMaterials] = useState<any[]>([]);
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<Control | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [systemAlert, setSystemAlert] = useState<string | null>(null);

  const [quickPhrases, setQuickPhrases] = useState<string[]>([
    "廠商延遲交貨", "已聯絡廠商催促", "等待進口報關中", "預計下週到貨", "物料測試檢驗中"
  ]);
  const [managePhrasesOpen, setManagePhrasesOpen] = useState(false);
  const [newPhrase, setNewPhrase] = useState('');
  const [editingPhraseIndex, setEditingPhraseIndex] = useState<number | null>(null);
  const [editPhraseText, setEditPhraseText] = useState('');
  const [sortBy, setSortBy] = useState('status_asc');

  // Filters
  const [searchStatus, setSearchStatus] = useState('all');
  const [searchMaterialId, setSearchMaterialId] = useState('');
  const [searchReqId, setSearchReqId] = useState('');
  const [sYear, setSYear] = useState('');
  const [sMonth, setSMonth] = useState('');
  const [sDay, setSDay] = useState('');
  const [eYear, setEYear] = useState('');
  const [eMonth, setEMonth] = useState('');
  const [eDay, setEDay] = useState('');

  const searchStartDate = sYear && sMonth && sDay ? `${sYear}-${sMonth.padStart(2, '0')}-${sDay.padStart(2, '0')}` : '';
  const searchEndDate = eYear && eMonth && eDay ? `${eYear}-${eMonth.padStart(2, '0')}-${eDay.padStart(2, '0')}` : '';

  const getDaysBadgeColor = (days: number) => {
    if (days >= 7) return 'bg-purple-100 text-purple-700 border-purple-200 font-black text-base shadow-sm px-3';
    if (days >= 5) return 'bg-red-100 text-red-700 border-red-200 font-bold px-2.5';
    if (days >= 3) return 'bg-amber-100 text-amber-700 border-amber-200 font-semibold px-2.5';
    return 'bg-green-100 text-green-700 border-green-200 font-medium px-2.5';
  };

  const [restockItemIndex, setRestockItemIndex] = useState<number | null>(null);
  const [enteredStock, setEnteredStock] = useState<string>('');
  const [restockDateStr, setRestockDateStr] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [data, mats, reqs, settingsData, holsData] = await Promise.all([
        getCollection('controls'),
        getCollection('materials'),
        getCollection('requisitions'),
        getCollection('settings'),
        getCollection('holidays')
      ]);
      const sortedData = (data as Control[]).sort((a, b) => (b.displayId || '').localeCompare(a.displayId || ''));
      setControls(sortedData);
      setMaterials(mats);
      setRequisitions(reqs);
      setHolidays(holsData);
      
      const phrasesDoc = (settingsData as any[]).find(s => s.id === 'quickPhrases');
      if (phrasesDoc && phrasesDoc.phrases) {
        setQuickPhrases(phrasesDoc.phrases);
      }
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

  const handleAddPhrase = async () => {
    if (!newPhrase.trim()) return;
    if (quickPhrases.includes(newPhrase.trim())) {
      setSystemAlert("此辭庫已經存在！");
      return;
    }
    const updated = [...quickPhrases, newPhrase.trim()];
    setQuickPhrases(updated);
    setNewPhrase('');
    await setDocumentWithId('settings', 'quickPhrases', { phrases: updated });
  };

  const handleSaveEditPhrase = async () => {
    if (editingPhraseIndex === null || !editPhraseText.trim()) return;
    if (quickPhrases[editingPhraseIndex] === editPhraseText.trim()) {
      setEditingPhraseIndex(null);
      return;
    }
    if (quickPhrases.includes(editPhraseText.trim())) {
      setSystemAlert("此辭庫已經存在！");
      return;
    }
    const updated = [...quickPhrases];
    updated[editingPhraseIndex] = editPhraseText.trim();
    setQuickPhrases(updated);
    setEditingPhraseIndex(null);
    await setDocumentWithId('settings', 'quickPhrases', { phrases: updated });
  };

  const handleDeletePhrase = async (phraseToDelete: string) => {
    const updated = quickPhrases.filter(p => p !== phraseToDelete);
    setQuickPhrases(updated);
    await setDocumentWithId('settings', 'quickPhrases', { phrases: updated });
  };

  const handleDeleteClick = (control: Control) => {
    const hasMissing = control.items.some(i => i.missingQuantity > 0);
    if (hasMissing) {
      setSystemAlert("此管制單尚有未補完的缺料項目，禁止刪除！");
      return;
    }
    setDeleteConfirmId(control.id!);
  };

  const handleDelete = async (id: string) => {
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
      setSystemAlert("請輸入有效的進貨當下總庫存數量！");
      return;
    }

    try {
      const requiredQty = item.requiredQuantity || 0;
      const finalStock = stockInput - requiredQty;
      
      await updateDocument('materials', item.materialId, { stock: finalStock });

      const newItems = [...formData.items];
      newItems[restockItemIndex] = {
        ...item,
        missingQuantity: 0,
        restockDate: restockDateStr
      };

      setFormData({ ...formData, items: newItems });
      setRestockItemIndex(null);
      setSystemAlert(`已成功設定補件！目前該物料扣除領用後，剩餘庫存為: ${finalStock}`);
    } catch (error) {
      console.error("Error restocking:", error);
      setSystemAlert("更新庫存時發生錯誤！");
    }
  };

  const handleSave = async () => {
    if (!formData || !formData.id) return;
    
    try {
      let toSave = { ...formData };
      
      const allRestocked = toSave.items.every(i => i.missingQuantity === 0 && i.restockDate !== '');
      
      if (allRestocked) {
        toSave.status = '已結案';
        const dates = toSave.items.map(i => new Date(i.restockDate).getTime());
        const maxDate = new Date(Math.max(...dates));
        toSave.completionDate = format(maxDate, 'yyyy-MM-dd');
        toSave.endDate = toSave.completionDate;
      }

      await updateDocument('controls', formData.id, toSave);
      
      if (toSave.requisitionId) {
        try {
          const allReqs = await getCollection('requisitions') as any[];
          const allMats = await getCollection('materials') as any[];
          const reqToUpdate = allReqs.find(r => r.id === toSave.requisitionId || r.displayId === toSave.requisitionId);
          
          if (reqToUpdate) {
            const updatedReqItems = reqToUpdate.items.map((reqItem: any) => {
              const ctrlItem = toSave.items.find(ci => ci.materialId === reqItem.materialId);
              // If this item was restocked in the control form, update missingQuantity and latest stock in requisition
              if (ctrlItem && ctrlItem.missingQuantity === 0 && ctrlItem.restockDate !== '') {
                const mat = allMats.find(m => m.id === reqItem.materialId);
                return { ...reqItem, missingQuantity: 0, currentStock: mat ? mat.stock : reqItem.currentStock };
              }
              return reqItem;
            });

            const stillMissing = updatedReqItems.some((i: any) => i.missingQuantity > 0);
            
            const reqUpdates: any = {
              items: updatedReqItems,
              status: stillMissing ? '缺料管制中' : '已完成'
            };

            if (allRestocked && !stillMissing) {
              reqUpdates.completionDate = toSave.completionDate;
            } else if (!stillMissing && !reqToUpdate.completionDate) {
              reqUpdates.completionDate = format(new Date(), 'yyyy-MM-dd');
            }

            await updateDocument('requisitions', reqToUpdate.id, reqUpdates);
          }
        } catch (syncError) {
          console.error("Error syncing to requisition:", syncError);
        }
      }

      setIsOpen(false);
      loadData();
    } catch (error) {
      console.error("Error saving control:", error);
    }
  };

  const calculateDays = (control: Control) => {
    const req = requisitions.find(r => r.id === control.requisitionId || r.displayId === control.requisitionId);
    if (!req || !req.returnDate) return 0;
    return calculateWorkingDays(req.returnDate, control.completionDate, holidays);
  };

  const filteredControls = controls.filter(control => {
    if (searchStatus !== 'all' && control.status !== searchStatus) return false;
    if (searchMaterialId && !control.items.some(i => (i.materialId || '').includes(searchMaterialId) || (i.materialName || '').includes(searchMaterialId))) return false;
    if (searchReqId && !(control.requisitionId || '').includes(searchReqId)) {
      const req = requisitions.find(r => r.id === control.requisitionId || r.displayId === control.requisitionId);
      if (!req || !(req.displayId || req.id || '').includes(searchReqId)) return false;
    }
    if (searchStartDate && control.completionDate && control.completionDate < searchStartDate) return false;
    if (searchEndDate && control.completionDate && control.completionDate > searchEndDate) return false;
    // If date range is specified but control has no completion date, it shouldn't match completed range
    if ((searchStartDate || searchEndDate) && !control.completionDate) return false;
    return true;
  });

  const sortedControls = [...filteredControls];
  if (sortBy === 'id_asc') sortedControls.sort((a, b) => (a.displayId || '').localeCompare(b.displayId || ''));
  else if (sortBy === 'id_desc') sortedControls.sort((a, b) => (b.displayId || '').localeCompare(a.displayId || ''));
  else if (sortBy === 'date_asc') sortedControls.sort((a, b) => a.startDate.localeCompare(b.startDate));
  else if (sortBy === 'date_desc') sortedControls.sort((a, b) => b.startDate.localeCompare(a.startDate));
  else if (sortBy === 'req_asc') sortedControls.sort((a, b) => {
    const reqA = requisitions.find(r => r.id === a.requisitionId || r.displayId === a.requisitionId);
    const reqB = requisitions.find(r => r.id === b.requisitionId || r.displayId === b.requisitionId);
    return (reqA?.displayId || a.requisitionId || '').localeCompare(reqB?.displayId || b.requisitionId || '');
  });
  else if (sortBy === 'req_desc') sortedControls.sort((a, b) => {
    const reqA = requisitions.find(r => r.id === a.requisitionId || r.displayId === a.requisitionId);
    const reqB = requisitions.find(r => r.id === b.requisitionId || r.displayId === b.requisitionId);
    return (reqB?.displayId || b.requisitionId || '').localeCompare(reqA?.displayId || a.requisitionId || '');
  });
  else if (sortBy === 'status_asc') sortedControls.sort((a, b) => {
    if (a.status === b.status) return (b.displayId || '').localeCompare(a.displayId || '');
    return a.status === '處理中' ? -1 : 1;
  });
  else if (sortBy === 'status_desc') sortedControls.sort((a, b) => {
    if (a.status === b.status) return (b.displayId || '').localeCompare(a.displayId || '');
    return a.status === '已結案' ? -1 : 1;
  });

  const totalItems = sortedControls.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedData = sortedControls.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      {/* System Warning Alert Dialog */}
      <Dialog open={!!systemAlert} onOpenChange={(open) => !open && setSystemAlert(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-primary">系統提示</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center font-bold text-lg">{systemAlert}</div>
          <div className="flex justify-center">
            <Button onClick={() => setSystemAlert(null)}>確認</Button>
          </div>
        </DialogContent>
      </Dialog>

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

      {/* Manage Phrases Dialog */}
      <Dialog open={managePhrasesOpen} onOpenChange={setManagePhrasesOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>管理常用辭庫</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Input 
                value={newPhrase} 
                onChange={e => setNewPhrase(e.target.value)} 
                placeholder="新增辭庫內容..." 
                onKeyDown={e => { if(e.key === 'Enter') handleAddPhrase(); }}
              />
              <Button onClick={handleAddPhrase}>新增</Button>
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-2 border rounded-md p-2">
              {quickPhrases.length === 0 ? (
                <div className="text-center text-muted-foreground py-4">尚無辭庫</div>
              ) : (
                quickPhrases.map((phrase, i) => (
                  <div key={i} className="flex justify-between items-center p-2 bg-muted/50 rounded hover:bg-muted">
                    {editingPhraseIndex === i ? (
                      <Input 
                        value={editPhraseText} 
                        onChange={e => setEditPhraseText(e.target.value)} 
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveEditPhrase(); }} 
                        autoFocus
                        className="h-8"
                      />
                    ) : (
                      <span className="text-sm">{phrase}</span>
                    )}
                    <div className="flex gap-1 ml-2">
                      {editingPhraseIndex === i ? (
                        <>
                          <Button variant="ghost" size="sm" onClick={handleSaveEditPhrase}>儲存</Button>
                          <Button variant="ghost" size="sm" onClick={() => setEditingPhraseIndex(null)}>取消</Button>
                        </>
                      ) : (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => { setEditingPhraseIndex(i); setEditPhraseText(phrase); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeletePhrase(phrase)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setManagePhrasesOpen(false)}>完成</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-primary">物料管制</h1>
      </div>

      <Dialog open={restockItemIndex !== null} onOpenChange={(open) => !open && setRestockItemIndex(null)}>
        <DialogContent className="max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
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
                  className="w-full h-12 text-lg font-bold shadow-sm"
                  style={{ colorScheme: 'light dark' }}
                  value={restockDateStr} 
                  onChange={(e) => setRestockDateStr(e.target.value)}
                  onClick={(e) => {
                    const target = e.target as HTMLInputElement;
                    if (target.showPicker) target.showPicker();
                  }}
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>編輯物料管制單 ({formData?.displayId || formData?.id?.slice(0,8)})</DialogTitle>
          </DialogHeader>
          {formData && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>關聯領料單號</Label>
                  <div className="flex h-10 w-full items-center px-3 rounded-md border border-input bg-muted/50 font-bold overflow-hidden text-ellipsis whitespace-nowrap">
                    {formData.requisitionId}
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
                <div className="flex justify-between items-center">
                  <Label className="text-lg">缺料項目清單</Label>
                  <span className="text-sm font-bold text-muted-foreground">總計: {formData.items.length} 筆</span>
                </div>
                {formData.items.map((item, index) => (
                  <Card key={index} className="bg-muted/30 relative overflow-hidden">
                    <div className="absolute top-0 left-0 bg-primary/20 px-2 py-1 rounded-br-lg text-xs font-bold text-primary">
                      #{index + 1}
                    </div>
                    <CardContent className="p-4 pt-6 grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-3 space-y-1">
                        <Label className="text-xs text-muted-foreground">物料品號</Label>
                        <div className="font-medium">
                          <span className="text-primary/70 mr-1 text-sm">[{materials.find(m => m.id === item.materialId)?.category || '未分類'}]</span>
                          {item.materialName}
                        </div>
                        <div className="text-xs text-muted-foreground">需領: {item.requiredQuantity || 0}</div>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs text-muted-foreground">缺件狀態</Label>
                        {item.missingQuantity > 0 ? (
                          <div className="font-bold text-destructive">缺 {item.missingQuantity} PCS</div>
                        ) : (
                          <div className="font-bold text-green-600">已補完</div>
                        )}
                      </div>
                      <div className="col-span-3 space-y-1">
                        <Label className="text-xs">補完日期與庫存</Label>
                        {item.restockDate ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-8 px-2 flex items-center bg-green-50 text-green-600 font-bold border rounded-md text-xs">
                              {item.restockDate}
                            </div>
                            <Button variant="outline" size="sm" className="h-8 text-xs px-2" onClick={() => handleRestockClick(index)}>
                              修改
                            </Button>
                          </div>
                        ) : (
                          <Button variant="outline" size="sm" className="w-full text-xs h-8" onClick={() => handleRestockClick(index)}>
                            設定補完日期
                          </Button>
                        )}
                      </div>
                      <div className="col-span-4 space-y-1">
                        <div className="flex justify-between items-center mb-1">
                          <Label className="text-xs font-bold text-muted-foreground">後續處理情況/備註</Label>
                          <Select onValueChange={(val) => handleItemNoteChange(index, item.notes ? `${item.notes}, ${val}` : val)}>
                            <SelectTrigger className="w-auto h-7 px-2 py-0 text-xs flex-shrink-0 font-medium">
                              <SelectValue placeholder="常用辭庫" />
                            </SelectTrigger>
                            <SelectContent>
                              {quickPhrases.map(phrase => (
                                <SelectItem key={phrase} value={phrase}>{phrase}</SelectItem>
                              ))}
                              <div className="p-2 border-t mt-1">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="w-full text-xs h-7" 
                                  onClick={(e) => { e.stopPropagation(); setManagePhrasesOpen(true); }}
                                >管理辭庫</Button>
                              </div>
                            </SelectContent>
                          </Select>
                        </div>
                        <textarea 
                          value={item.notes} 
                          onChange={(e) => handleItemNoteChange(index, e.target.value)}
                          placeholder="進度說明..."
                          className="flex min-h-[70px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t">
                <Button variant="outline" onClick={() => setIsOpen(false)}>取消修改</Button>
                <Button onClick={handleSave}>儲存更新</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card className="mb-6 p-4 bg-muted/30">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>查詢狀態</Label>
              <Select value={searchStatus} onValueChange={setSearchStatus}>
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
              <Label>查詢物料品號</Label>
              <Input placeholder="輸入物料品號" value={searchMaterialId} onChange={(e) => setSearchMaterialId(e.target.value)} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>排序方式</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="預設排序" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">預設排序</SelectItem>
                  <SelectItem value="status_asc">狀態 (處理中 - 已結案)</SelectItem>
                  <SelectItem value="status_desc">狀態 (已結案 - 處理中)</SelectItem>
                  <SelectItem value="id_asc">管制單號 (由小到大)</SelectItem>
                  <SelectItem value="id_desc">管制單號 (由大到小)</SelectItem>
                  <SelectItem value="date_asc">管制開始日期 (舊到新)</SelectItem>
                  <SelectItem value="date_desc">管制開始日期 (新到舊)</SelectItem>
                  <SelectItem value="req_asc">關聯領料單 (由小到大)</SelectItem>
                  <SelectItem value="req_desc">關聯領料單 (由大到小)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>查詢關聯領料單號</Label>
              <Input placeholder="輸入領料單號" value={searchReqId} onChange={(e) => setSearchReqId(e.target.value)} />
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>完成日期 (起)</Label>
            <div className="flex gap-2">
              <Select value={sYear} onValueChange={(v) => { setSYear(v); setEYear(v); }}>
                <SelectTrigger><SelectValue placeholder="年" /></SelectTrigger>
                <SelectContent>
                  {[...Array(5)].map((_, i) => {
                    const y = new Date().getFullYear() - 2 + i;
                    return <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  })}
                </SelectContent>
              </Select>
              <Select value={sMonth} onValueChange={(v) => { setSMonth(v); setEMonth(v); }}>
                <SelectTrigger><SelectValue placeholder="月" /></SelectTrigger>
                <SelectContent>
                  {[...Array(12)].map((_, i) => <SelectItem key={i+1} value={(i+1).toString()}>{i+1}月</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={sDay} onValueChange={(v) => { setSDay(v); setEDay(v); }}>
                <SelectTrigger><SelectValue placeholder="日" /></SelectTrigger>
                <SelectContent>
                  {[...Array(31)].map((_, i) => <SelectItem key={i+1} value={(i+1).toString()}>{i+1}日</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={() => { setSYear(''); setSMonth(''); setSDay(''); setEYear(''); setEMonth(''); setEDay(''); }}>×</Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>完成日期 (迄)</Label>
            <div className="flex gap-2">
              <Select value={eYear} onValueChange={setEYear}>
                <SelectTrigger><SelectValue placeholder="年" /></SelectTrigger>
                <SelectContent>
                  {[...Array(5)].map((_, i) => {
                    const y = new Date().getFullYear() - 2 + i;
                    return <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  })}
                </SelectContent>
              </Select>
              <Select value={eMonth} onValueChange={setEMonth}>
                <SelectTrigger><SelectValue placeholder="月" /></SelectTrigger>
                <SelectContent>
                  {[...Array(12)].map((_, i) => <SelectItem key={i+1} value={(i+1).toString()}>{i+1}月</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={eDay} onValueChange={setEDay}>
                <SelectTrigger><SelectValue placeholder="日" /></SelectTrigger>
                <SelectContent>
                  {[...Array(31)].map((_, i) => <SelectItem key={i+1} value={(i+1).toString()}>{i+1}日</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={() => { setEYear(''); setEMonth(''); setEDay(''); }}>×</Button>
            </div>
          </div>
          </div>
        </div>
      </Card>

      <div className="flex justify-between items-center bg-muted/50 p-4 rounded-md mb-6">
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
                <TableHead>狀態</TableHead>
                <TableHead>管制單號</TableHead>
                <TableHead>關聯領料單</TableHead>
                <TableHead>缺料項目總數</TableHead>
                <TableHead>缺件狀態</TableHead>
                <TableHead>完成日期</TableHead>
                <TableHead>管制天數</TableHead>
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
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(control)} disabled={control.status === '已結案'}>刪除</Button>
                      </div>
                    </TableCell>
                    <TableCell>{(page - 1) * pageSize + index + 1}</TableCell>
                    <TableCell>
                      <Badge variant={control.status === '已結案' ? 'default' : 'secondary'} className={control.status === '處理中' ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}>
                        {control.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold">{control.displayId || control.id?.slice(0, 8)}</TableCell>
                    <TableCell>
                      <span className="text-sm font-bold bg-blue-100 text-blue-700 border border-blue-200 px-2 py-1 rounded-md shadow-sm">
                        {control.requisitionId}
                      </span>
                    </TableCell>
                    <TableCell className="text-destructive font-black text-lg">{control.items.length}</TableCell>
                    <TableCell>
                      {control.items.filter(i => (i.missingQuantity || 0) > 0).length > 0 ? (
                        <div className="flex flex-col gap-1 text-sm">
                          {control.items.filter(i => (i.missingQuantity || 0) > 0).map((item, idx) => (
                            <span key={idx} className="font-bold text-destructive">
                              {item.materialName || item.materialId}: 缺 {item.missingQuantity} PCS
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="font-bold text-green-700">已補完</span>
                      )}
                    </TableCell>
                    <TableCell>{control.completionDate || '-'}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center justify-center min-w-[3rem] py-1 rounded-md border ${getDaysBadgeColor(calculateDays(control))}`}>
                        {calculateDays(control)} 天
                      </span>
                    </TableCell>
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
