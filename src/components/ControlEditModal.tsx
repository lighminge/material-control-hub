import { useState, useEffect } from 'react';
import { getCollection, updateDocument, setDocumentWithId } from '@/lib/firebase/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Trash2, Pencil } from 'lucide-react';

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
  endDate: string;
  status: string;
  items: ControlItem[];
  notes?: string;
  completionDate?: string;
};

interface Props {
  control: Control | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function ControlEditModal({ control, isOpen, onClose, onSaved }: Props) {
  const [formData, setFormData] = useState<Control | null>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [quickPhrases, setQuickPhrases] = useState<string[]>([]);
  const [systemAlert, setSystemAlert] = useState<string | null>(null);
  const [managePhrasesOpen, setManagePhrasesOpen] = useState(false);
  const [newPhrase, setNewPhrase] = useState('');
  const [editingPhraseIndex, setEditingPhraseIndex] = useState<number | null>(null);
  const [editPhraseText, setEditPhraseText] = useState('');
  
  const [restockItemIndex, setRestockItemIndex] = useState<number | null>(null);
  const [enteredStock, setEnteredStock] = useState<string>('');
  const [restockDateStr, setRestockDateStr] = useState<string>('');

  useEffect(() => {
    if (control) {
      setFormData({ ...control });
    }
  }, [control]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const [mats, settingsData] = await Promise.all([
        getCollection('materials'),
        getCollection('settings')
      ]);
      setMaterials(mats as any[]);
      
      const phrasesDoc = (settingsData as any[]).find(s => s.id === 'quickPhrases');
      if (phrasesDoc && phrasesDoc.phrases) {
        setQuickPhrases(phrasesDoc.phrases);
      } else {
        setQuickPhrases([
          '廠商延遲交貨',
          '已聯絡廠商催促',
          '等待進口報關中',
          '預計下週到貨',
          '物料測試檢驗中'
        ]);
      }
    } catch (error) {
      console.error(error);
    }
  };

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
      console.error(error);
      setSystemAlert("更新庫存時發生錯誤！");
    }
  };

  const handleUndoRestock = async (index: number) => {
    if (!formData) return;
    const item = formData.items[index];
    
    // Original missing quantity should be restored
    const originalMissing = (item as any).originalMissingQuantity || item.requiredQuantity || 1;

    try {
      // Revert the stock (add back the required quantity that was deducted)
      const allMats = await getCollection('materials') as any[];
      const mat = allMats.find(m => m.id === item.materialId);
      if (mat) {
        const revertedStock = (mat.stock || 0) + (item.requiredQuantity || 0);
        await updateDocument('materials', item.materialId, { stock: revertedStock });
      }

      const newItems = [...formData.items];
      newItems[index] = {
        ...item,
        missingQuantity: originalMissing,
        restockDate: ''
      };
      
      setFormData({ ...formData, items: newItems });
      setSystemAlert("已撤銷補完，回復缺料狀況。庫存已調整回復。");
    } catch (error) {
      console.error(error);
      setSystemAlert("撤銷發生錯誤！");
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
      } else {
        toSave.status = '處理中';
        toSave.completionDate = null as any;
        toSave.endDate = null as any;
      }

      await updateDocument('controls', formData.id, toSave);
      
      if (toSave.requisitionId) {
        try {
          const allReqs = await getCollection('requisitions') as any[];
          const allMats = await getCollection('materials') as any[];
          const reqToUpdate = allReqs.find(r => r.id === toSave.requisitionId || r.displayId === toSave.requisitionId);
          
          if (reqToUpdate) {
            const updatedReqItems = reqToUpdate.items.map((reqItem: any) => {
              const ctrlItem = toSave.items.find((ci: any) => ci.materialId === reqItem.materialId);
              if (ctrlItem) {
                if (ctrlItem.missingQuantity === 0 && ctrlItem.restockDate !== '') {
                  const mat = allMats.find(m => m.id === reqItem.materialId);
                  return { ...reqItem, missingQuantity: 0, currentStock: mat ? mat.stock : reqItem.currentStock };
                } else if (ctrlItem.missingQuantity > 0) {
                  const restoredMissing = (ctrlItem as any).originalMissingQuantity || ctrlItem.missingQuantity;
                  return { ...reqItem, missingQuantity: restoredMissing, restockDate: '' };
                }
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
            } else if (stillMissing) {
              reqUpdates.completionDate = null;
            } else if (!stillMissing && !reqToUpdate.completionDate) {
              reqUpdates.completionDate = format(new Date(), 'yyyy-MM-dd');
            }

            await updateDocument('requisitions', reqToUpdate.id, reqUpdates);
          }
        } catch (error) {
          console.error("Error syncing to requisition:", error);
        }
      }
      
      onSaved();
      onClose();
    } catch (error) {
      console.error(error);
      setSystemAlert("儲存時發生錯誤");
    }
  };

  return (
    <>
      <Dialog open={!!systemAlert} onOpenChange={(open) => !open && setSystemAlert(null)}>
        <DialogContent className="max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>系統通知</DialogTitle>
          </DialogHeader>
          <div className="py-4">{systemAlert}</div>
          <div className="flex justify-end">
            <Button onClick={() => setSystemAlert(null)}>確認</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={managePhrasesOpen} onOpenChange={setManagePhrasesOpen}>
        <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>管理常用辭庫</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex gap-2">
              <Input 
                value={newPhrase} 
                onChange={(e) => setNewPhrase(e.target.value)}
                placeholder="輸入新辭庫內容..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddPhrase();
                }}
              />
              <Button onClick={handleAddPhrase}>新增</Button>
            </div>
            <div className="border rounded-md max-h-[300px] overflow-y-auto">
              <Table>
                <TableBody>
                  {quickPhrases.map((phrase, i) => (
                    <TableRow key={i}>
                      <TableCell className="w-full">
                        {editingPhraseIndex === i ? (
                          <Input 
                            value={editPhraseText} 
                            onChange={(e) => setEditPhraseText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEditPhrase();
                              if (e.key === 'Escape') setEditingPhraseIndex(null);
                            }}
                            autoFocus
                          />
                        ) : (
                          phrase
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
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
                      </TableCell>
                    </TableRow>
                  ))}
                  {quickPhrases.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-4">
                        目前沒有常用辭庫
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setManagePhrasesOpen(false)}>完成</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={restockItemIndex !== null} onOpenChange={(open) => !open && setRestockItemIndex(null)}>
        <DialogContent className="max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>設定缺件補完與庫存</DialogTitle>
          </DialogHeader>
          {restockItemIndex !== null && formData && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>補件日期</Label>
                <Input 
                  type="date" 
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

      <Dialog open={isOpen} onOpenChange={(open) => {
          if(!open) onClose();
      }}>
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
                          <div className="flex items-center gap-1">
                            <div className="flex-1 h-8 px-2 flex items-center bg-green-50 text-green-600 font-bold border rounded-md text-xs">
                              {item.restockDate}
                            </div>
                            <Button variant="outline" size="sm" className="h-8 text-xs px-2" onClick={() => handleRestockClick(index)}>
                              修改
                            </Button>
                            <Button variant="destructive" size="sm" className="h-8 text-xs px-2" onClick={() => handleUndoRestock(index)}>
                              撤銷
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
                <Button variant="outline" onClick={() => onClose()}>取消修改</Button>
                <Button onClick={handleSave}>儲存更新</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
