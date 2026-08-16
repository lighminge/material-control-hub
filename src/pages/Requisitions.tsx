import { useState, useEffect } from 'react';
import { getCollection, updateDocument, deleteDocument, setDocumentWithId, generateCustomId, getControlsByRequisitionId } from '@/lib/firebase/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, ChevronsUpDown, Check, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Material } from './Materials';

export type RequisitionItem = {
  materialId: string;
  materialName: string;
  requiredQuantity: number;
  currentStock: number;
  missingQuantity: number;
  restockDate?: string;
};

export type Requisition = {
  id?: string;
  displayId?: string;
  controlDisplayId?: string | null;
  category?: string;
  staffId: string;
  staffName: string;
  itemCount: number;
  items: RequisitionItem[];
  status: '已完成' | '缺料管制中';
  completionDate?: string | null;
  createdAt?: any;
};

export default function RequisitionsPage() {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [itemToDeleteIndex, setItemToDeleteIndex] = useState<number | null>(null);
  
  const [systemAlert, setSystemAlert] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // Filters
  const [searchReqId, setSearchReqId] = useState('');
  const [searchCtrlId, setSearchCtrlId] = useState('');
  const [searchStaff, setSearchStaff] = useState('all');
  const [searchCategory, setSearchCategory] = useState('all');

  // Combobox popover open states
  const [openComboboxIndex, setOpenComboboxIndex] = useState<number | null>(null);

  const [formData, setFormData] = useState<Requisition>({
    displayId: '',
    category: '未分類',
    staffId: '',
    staffName: '',
    itemCount: 0,
    items: [],
    status: '已完成'
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqs, staffs, mats] = await Promise.all([
        getCollection('requisitions'),
        getCollection('staff'),
        getCollection('materials')
      ]);
      const sortedReqs = (reqs as Requisition[]).sort((a, b) => (b.displayId || '').localeCompare(a.displayId || ''));
      setRequisitions(sortedReqs);
      setStaffList(staffs);
      setMaterials(mats as Material[]);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStaffChange = (staffId: string) => {
    const staff = staffList.find(s => s.id === staffId);
    setFormData({ ...formData, staffId, staffName: staff?.name || '' });
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { materialId: '', materialName: '', requiredQuantity: 1, currentStock: 0, missingQuantity: 0 }
      ]
    });
  };

  const handleRemoveItem = (index: number) => {
    setItemToDeleteIndex(index);
  };

  const confirmRemoveItem = () => {
    if (itemToDeleteIndex !== null && formData) {
      const newItems = formData.items.filter((_, i) => i !== itemToDeleteIndex);
      
      const hasMissing = newItems.some(i => i.missingQuantity > 0);
      setFormData({ 
        ...formData, 
        items: newItems,
        itemCount: newItems.length,
        status: hasMissing ? '缺料管制中' : '已完成'
      });
      setItemToDeleteIndex(null);
    }
  };

  const handleItemChange = (index: number, field: keyof RequisitionItem, value: any) => {
    const newItems = [...formData.items];
    const item = { ...newItems[index] };
    
    if (field === 'materialId') {
      // Check for duplicate
      if (newItems.some((i, idx) => idx !== index && i.materialId === value)) {
        setSystemAlert("此物料已經在清單中！同一張領料單不可選取重複的物料。");
        return;
      }
      
      const mat = materials.find(m => m.id === value);
      item.materialId = value;
      item.materialName = mat?.name || '';
      item.currentStock = mat?.stock || 0;
    } else if (field === 'requiredQuantity') {
      item.requiredQuantity = parseInt(value) || 0;
    }

    item.missingQuantity = Math.max(0, item.requiredQuantity - item.currentStock);
    newItems[index] = item;

    const hasMissing = newItems.some(i => i.missingQuantity > 0);
    
    setFormData({ 
      ...formData, 
      items: newItems, 
      itemCount: newItems.length,
      status: hasMissing ? '缺料管制中' : '已完成'
    });
  };

  const handleSave = async () => {
    if (!formData.displayId || formData.displayId.trim() === '') {
      setSystemAlert("請輸入領料單號！");
      return;
    }

    if (!formData.staffId) {
      setSystemAlert("請選擇備料人員！");
      return;
    }
    
    // Check for duplicate displayId
    const isDuplicateId = requisitions.some(r => r.displayId === formData.displayId && r.id !== editingId);
    if (isDuplicateId) {
      setSystemAlert(`領料單號 [${formData.displayId}] 已經存在，請輸入其他的單號！`);
      return;
    }

    try {
      let finalReqId = editingId;
      let finalControlDisplayId = formData.controlDisplayId;
      let isNewControlNeeded = false;

      const completionDate = formData.status === '已完成' ? format(new Date(), 'yyyy-MM-dd') : null;

      if (!editingId) {
        // We use the manually entered displayId as the Firestore document ID to keep it simple and unified.
        finalReqId = formData.displayId; 
        
        if (formData.status === '缺料管制中') {
          finalControlDisplayId = await generateCustomId('controls', '管');
          isNewControlNeeded = true;
        }

        const sanitizedItems = formData.items.map(i => {
          const itemCopy = { ...i };
          if (itemCopy.restockDate === undefined) {
            delete itemCopy.restockDate;
          }
          return itemCopy;
        });

        const dataToSave = {
          ...formData,
          items: sanitizedItems,
          controlDisplayId: finalControlDisplayId || null,
          completionDate
        };
        await setDocumentWithId('requisitions', finalReqId, dataToSave);
      } else {
        // Update existing requisition
        const existingControls = await getControlsByRequisitionId(editingId);
        
        if (existingControls.length > 0) {
          const existingControl = existingControls[0] as any;
          finalControlDisplayId = existingControl.id;
          
          const newControlItems = formData.items
            .filter(i => i.missingQuantity > 0 || (i.missingQuantity === 0 && i.restockDate))
            .map(i => {
              const existingItem = existingControl.items?.find((ei: any) => ei.materialId === i.materialId);
              // Maintain existing restockDate if it exists and quantity is 0
              const restockDate = (i.missingQuantity === 0 && i.restockDate) ? i.restockDate : (existingItem?.restockDate || '');
              return {
                materialId: i.materialId,
                materialName: i.materialName,
                requiredQuantity: i.requiredQuantity,
                missingQuantity: i.missingQuantity,
                restockDate,
                notes: existingItem?.notes || ''
              };
            });

          const allRestocked = newControlItems.length > 0 && newControlItems.every(i => i.missingQuantity === 0 && i.restockDate);
          const noItemsLeft = newControlItems.length === 0;
          
          const controlStatus = (allRestocked || noItemsLeft) ? '已結案' : '處理中';
          const controlCompletionDate = (allRestocked || noItemsLeft) ? format(new Date(), 'yyyy-MM-dd') : null;

          await updateDocument('controls', existingControl.id, {
            items: newControlItems,
            status: controlStatus,
            completionDate: controlCompletionDate,
            endDate: controlCompletionDate
          });
        } else if (formData.status === '缺料管制中') {
          finalControlDisplayId = await generateCustomId('controls', '管');
          isNewControlNeeded = true;
        }

        const sanitizedItems = formData.items.map(i => {
          const itemCopy = { ...i };
          if (itemCopy.restockDate === undefined) {
            delete itemCopy.restockDate;
          }
          return itemCopy;
        });

        const dataToSave = {
          ...formData,
          items: sanitizedItems,
          controlDisplayId: finalControlDisplayId || null,
          completionDate
        };
        await updateDocument('requisitions', editingId, dataToSave);
      }
      
      // Create control if needed
      if (isNewControlNeeded && finalControlDisplayId && finalReqId) {
        const controlItems = formData.items
          .filter(i => i.missingQuantity > 0)
          .map(i => ({
            materialId: i.materialId,
            materialName: i.materialName,
            requiredQuantity: i.requiredQuantity,
            missingQuantity: i.missingQuantity,
            restockDate: '',
            notes: ''
          }));
        
        await setDocumentWithId('controls', finalControlDisplayId, {
          displayId: finalControlDisplayId,
          requisitionId: finalReqId,
          startDate: format(new Date(), 'yyyy-MM-dd'),
          endDate: null,
          items: controlItems,
          status: '處理中',
          notes: '由領料單自動產生',
          completionDate: null
        });
      }

      setIsOpen(false);
      loadData();
      setSystemAlert("單據已成功儲存！");
    } catch (error: any) {
      console.error("Error saving requisition:", error);
      setSystemAlert("儲存時發生錯誤: " + (error.message || String(error)));
    }
  };

  const handleDeleteClick = (req: Requisition) => {
    const hasMissing = req.items.some(i => i.missingQuantity > 0);
    if (hasMissing) {
      setSystemAlert("此領料單尚有未補完的缺料項目，禁止刪除！");
      return;
    }
    setDeleteConfirmId(req.id!);
  };

  const handleDelete = async (id: string) => {
    await deleteDocument('requisitions', id);
    setDeleteConfirmId(null);
    loadData();
  };

  const openNewForm = () => {
    setFormData({ displayId: '', category: '未分類', staffId: '', staffName: '', itemCount: 0, items: [], status: '已完成' });
    setEditingId(null);
    setIsOpen(true);
  };

  const filteredRequisitions = requisitions.filter(req => {
    if (searchReqId && !(req.displayId || '').includes(searchReqId)) return false;
    if (searchCtrlId && !(req.controlDisplayId || '').includes(searchCtrlId)) return false;
    if (searchStaff !== 'all' && req.staffId !== searchStaff) return false;
    if (searchCategory !== 'all' && (req.category || '未分類') !== searchCategory) return false;
    return true;
  });

  const totalItems = filteredRequisitions.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedData = filteredRequisitions.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      {/* System Alert Dialog */}
      <Dialog open={!!systemAlert} onOpenChange={(open) => !open && setSystemAlert(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={systemAlert?.includes('成功') ? 'text-primary' : 'text-destructive'}>
              系統提示
            </DialogTitle>
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
          <div className="py-4">您確定要刪除此領料單嗎？此動作無法復原。</div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>取消</Button>
            <Button variant="destructive" onClick={() => { if(deleteConfirmId) handleDelete(deleteConfirmId); }}>確認刪除</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-primary">領料單管理</h1>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNewForm}>新增領料單</Button>
          </DialogTrigger>
          {/* Prevent closing by interacting outside */}
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>{editingId ? `編輯領料單` : '新增領料單'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>領料單號</Label>
                  <Input 
                    value={formData.displayId || ''} 
                    onChange={(e) => setFormData({...formData, displayId: e.target.value})} 
                    placeholder="輸入領料單號"
                    disabled={!!editingId} // Cannot edit ID after creation
                  />
                </div>
                <div className="space-y-2">
                  <Label>備料人員</Label>
                  <Select value={formData.staffId} onValueChange={handleStaffChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="選擇備料人員" />
                    </SelectTrigger>
                    <SelectContent>
                      {staffList.map(staff => (
                        <SelectItem key={staff.id} value={staff.id}>{staff.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>領料單分類</Label>
                  <Select value={formData.category || '未分類'} onValueChange={(val) => setFormData({ ...formData, category: val })}>
                    <SelectTrigger>
                      <SelectValue placeholder="選擇分類" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="未分類">未分類</SelectItem>
                      <SelectItem value="TKW">TKW</SelectItem>
                      <SelectItem value="夾鉗">夾鉗</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editingId && (
                  <div className="space-y-2 col-span-2 sm:col-span-1">
                    <Label>關聯管制單號</Label>
                    <div className="flex h-10 w-full items-center px-3 rounded-md border border-input bg-muted/50">
                      {formData.controlDisplayId || '無'}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <Label className="text-lg mr-4">物料項目</Label>
                    <span className="text-sm font-bold text-muted-foreground">總計: {formData.items.length} 筆</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleAddItem}>
                    <Plus className="w-4 h-4 mr-2" /> 新增項目
                  </Button>
                </div>
                
                {formData.items.length === 0 && (
                  <div className="text-center text-muted-foreground p-4 border rounded-md">
                    尚未加入任何物料
                  </div>
                )}

                {formData.items.map((item, index) => {
                  const isCompleted = !!(item.missingQuantity === 0 && item.restockDate);
                  return (
                  <div key={index} className="flex items-center gap-4 border p-4 rounded-md bg-muted/50 relative pt-8">
                    <div className="absolute top-0 left-0 bg-primary/20 px-2 py-1 rounded-br-lg text-xs font-bold text-primary">#{index + 1}</div>
                    <div className="flex-1 space-y-2">
                      <Label>選擇物料品號</Label>
                      <Popover open={openComboboxIndex === index} onOpenChange={(open: boolean) => setOpenComboboxIndex(open ? index : null)}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={openComboboxIndex === index}
                            className="w-full justify-between bg-background"
                            disabled={isCompleted}
                          >
                            {item.materialId
                              ? materials.find((m) => m.id === item.materialId)?.name
                              : "搜尋並選擇物料品號..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="輸入關鍵字搜尋..." />
                            <CommandList>
                              <CommandEmpty>找不到對應的物料。</CommandEmpty>
                              <CommandGroup>
                                {materials.map((mat) => (
                                  <CommandItem
                                    key={mat.id}
                                    value={mat.name} // By default, CommandItem filters based on text content / value
                                    onSelect={() => {
                                      handleItemChange(index, 'materialId', mat.id);
                                      setOpenComboboxIndex(null);
                                    }}
                                  >
                                    <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          item.materialId === mat.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <span className="text-primary/70 mr-1 text-xs">[{mat.category || '未分類'}]</span> {mat.name} <span className="ml-auto text-muted-foreground">(庫存: {mat.stock})</span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="w-32 space-y-2">
                      <Label>需領數量</Label>
                      <Input 
                        type="number" 
                        value={item.requiredQuantity} 
                        onChange={(e) => handleItemChange(index, 'requiredQuantity', e.target.value)} 
                        min="1"
                        disabled={isCompleted}
                      />
                    </div>
                    <div className="w-24 space-y-2">
                      <Label>目前庫存</Label>
                      <div className="h-10 flex items-center px-3 border rounded-md bg-background text-muted-foreground">
                        {item.currentStock}
                      </div>
                    </div>
                    <div className="w-24 space-y-2">
                      <Label>缺料數量</Label>
                      {isCompleted ? (
                        <div className="flex flex-col gap-1">
                          <div className="h-10 flex items-center justify-center border rounded-md font-bold text-white bg-green-600 text-xs">
                            已補完
                          </div>
                          <div className="text-sm text-center text-primary font-black mt-1">
                            {item.restockDate}
                          </div>
                        </div>
                      ) : (
                        <div className={`h-10 flex items-center px-3 border rounded-md font-bold ${item.missingQuantity > 0 ? 'text-destructive bg-destructive/10' : 'text-green-600 bg-green-50'}`}>
                          {item.missingQuantity}
                        </div>
                      )}
                    </div>
                    <div className="pt-6">
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(index)} disabled={isCompleted}>
                        <Trash2 className="w-5 h-5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  );
                })}
              </div>

              <div className="pt-4 flex justify-between items-center border-t">
                <div className="font-medium">
                  單據狀態: <Badge variant={formData.status === '已完成' ? 'default' : 'destructive'} className="ml-2">{formData.status}</Badge>
                </div>
                <div className="flex gap-2">
                  {editingId && (
                    <Button variant="outline" onClick={() => setIsOpen(false)}>取消修改</Button>
                  )}
                  <Button onClick={handleSave}>儲存單據</Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={itemToDeleteIndex !== null} onOpenChange={(open) => !open && setItemToDeleteIndex(null)}>
        <DialogContent className="max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" />
              確認刪除項目
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            您確定要刪除第 {itemToDeleteIndex !== null ? itemToDeleteIndex + 1 : ''} 項物料嗎？
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setItemToDeleteIndex(null)}>取消</Button>
            <Button variant="destructive" onClick={confirmRemoveItem}>確定刪除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

      <Card className="mb-6 p-4 bg-muted/30">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>查詢領料單號</Label>
            <Input placeholder="輸入單號" value={searchReqId} onChange={(e) => setSearchReqId(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>查詢關聯管制單號</Label>
            <Input placeholder="輸入管制單號" value={searchCtrlId} onChange={(e) => setSearchCtrlId(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>備料人員</Label>
            <Select value={searchStaff} onValueChange={setSearchStaff}>
              <SelectTrigger>
                <SelectValue placeholder="全部人員" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部人員</SelectItem>
                {staffList.map(staff => (
                  <SelectItem key={staff.id} value={staff.id}>{staff.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>領料單分類</Label>
            <Select value={searchCategory} onValueChange={setSearchCategory}>
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

      <div className="flex justify-between items-center bg-muted/50 p-4 rounded-md">
        <div className="font-medium">總計: {totalItems} 筆領料單</div>
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
                <TableHead className="w-[140px]">操作</TableHead>
                <TableHead className="w-16">序號</TableHead>
                <TableHead>領料單號</TableHead>
                <TableHead>領料單分類</TableHead>
                <TableHead>關聯管制單號</TableHead>
                <TableHead>備料人員</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>完成日期</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center h-24">載入中...</TableCell>
                </TableRow>
              ) : paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center h-24">尚無領料單資料</TableCell>
                </TableRow>
              ) : (
                paginatedData.map((req, index) => (
                  <TableRow key={req.id}>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={async () => {
                          const existingControls = await getControlsByRequisitionId(req.id || '');
                          const existingControl = existingControls[0] as any;

                          const updatedItems = req.items.map(item => {
                            const mat = materials.find(m => m.id === item.materialId);
                            const ctrlItem = existingControl?.items?.find((ei: any) => ei.materialId === item.materialId);
                            return { 
                              ...item, 
                              currentStock: mat ? mat.stock : item.currentStock,
                              restockDate: ctrlItem?.restockDate || item.restockDate
                            };
                          });
                          setFormData({ ...req, items: updatedItems });
                          setEditingId(req.id || null);
                          setIsOpen(true);
                        }}>編輯</Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(req)} disabled={req.status === '已完成'}>刪除</Button>
                      </div>
                    </TableCell>
                    <TableCell>{(page - 1) * pageSize + index + 1}</TableCell>
                    <TableCell className="font-bold">{req.displayId || req.id?.slice(0,8)}</TableCell>
                    <TableCell>{req.category || '未分類'}</TableCell>
                    <TableCell className="text-muted-foreground">{req.controlDisplayId || '-'}</TableCell>
                    <TableCell>{req.staffName}</TableCell>
                    <TableCell>
                      <Badge variant={req.status === '已完成' ? 'default' : 'destructive'}>
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{req.completionDate || '-'}</TableCell>
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
