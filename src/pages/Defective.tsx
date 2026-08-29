import { useState, useEffect, useMemo } from 'react';
import { getCollection, addDocument, deleteDocument, getDocument, setDocumentWithId } from '@/lib/firebase/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, X, ListPlus, Pencil, Check, Trash2, AlertCircle, Copy } from 'lucide-react';

export type Defect = {
  id?: string;
  formId: string;
  date: string;
  materialId: string;
  materialName: string;
  condition: string;
  discoverer: string;
  quantity?: number;
  workOrder?: string;
  workOrderQuantity?: number;
  category?: string;
  headType?: string;
  createdAt?: string;
};

export type DefectItemState = {
  id?: string;
  materialId: string;
  materialName: string;
  condition: string;
  quantity: number | '';
  workOrder: string;
  workOrderQuantity: number | '';
  category: string;
  headType: string;
};

export type DefectFormState = {
  id?: string; // We don't strictly need a single id for a form in a flat DB, but good to have
  formId: string;
  date: string;
  discoverer: string;
  items: DefectItemState[];
};

export default function DefectivePage() {
  const [defects, setDefects] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  
  const [isOpen, setIsOpen] = useState(false);
  const [deleteConfirmFormId, setDeleteConfirmFormId] = useState<string | null>(null);
  
  const defaultItem: DefectItemState = {
    materialId: '',
    materialName: '',
    condition: '',
    quantity: '',
    workOrder: '',
    workOrderQuantity: '',
    category: '',
    headType: ''
  };

  const [formData, setFormData] = useState<DefectFormState>({
    formId: '',
    date: new Date().toISOString().split('T')[0],
    discoverer: '',
    items: [{ ...defaultItem }]
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Quick Phrases
  const [activePhraseIndex, setActivePhraseIndex] = useState<number | null>(null);
  const [phrases, setPhrases] = useState<string[]>([]);
  const [newPhrase, setNewPhrase] = useState('');
  const [editingPhraseIndex, setEditingPhraseIndex] = useState<number | null>(null);
  const [editPhraseText, setEditPhraseText] = useState('');
  
  const [systemAlert, setSystemAlert] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  
  // Filters
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterMaterialId, setFilterMaterialId] = useState('');
  const [filterMaterialName, setFilterMaterialName] = useState('');
  const [filterDiscoverer, setFilterDiscoverer] = useState('all');
  const [filterCondition, setFilterCondition] = useState('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // Sorting
  const [sortField, setSortField] = useState<'formId'|'date'|'materialId'|'materialName'>('formId');
  const [sortOrder, setSortOrder] = useState<'asc'|'desc'>('asc');
  
  const loadData = async () => {
    setLoading(true);
    try {
      const [data, matsData, staffsData] = await Promise.all([
        getCollection('defects'),
        getCollection('materials'),
        getCollection('staff')
      ]);
      setMaterials(matsData);
      setStaffList(staffsData);
      const sorted = (data as Defect[]).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setDefects(sorted);
      
      const phrasesDoc = await getDocument('settings', 'defectivePhrases');
      if (phrasesDoc && (phrasesDoc as any).phrases) {
        setPhrases((phrasesDoc as any).phrases);
      } else {
        setPhrases(['外觀不良', '尺寸不符', '材質異常', '表面刮傷']);
      }
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('defectsUpdated', handleUpdate);
    return () => window.removeEventListener('defectsUpdated', handleUpdate);
  }, []);

  const savePhrases = async (newPhrases: string[]) => {
    setPhrases(newPhrases);
    await setDocumentWithId('settings', 'defectivePhrases', { phrases: newPhrases });
  };

  const addPhrase = () => {
    if (newPhrase.trim() && !phrases.includes(newPhrase.trim())) {
      savePhrases([...phrases, newPhrase.trim()]);
      setNewPhrase('');
    }
  };

  const handleSaveEditPhrase = async () => {
    if (editingPhraseIndex === null || !editPhraseText.trim()) return;
    if (phrases[editingPhraseIndex] === editPhraseText.trim()) {
      setEditingPhraseIndex(null);
      return;
    }
    if (phrases.includes(editPhraseText.trim())) {
      setSystemAlert("此常用內容已經存在！");
      return;
    }
    const updated = [...phrases];
    updated[editingPhraseIndex] = editPhraseText.trim();
    savePhrases(updated);
    setEditingPhraseIndex(null);
  };

  const removePhrase = (phrase: string) => {
    if (confirm('確定要刪除這筆常用內容嗎？')) {
      savePhrases(phrases.filter(p => p !== phrase));
    }
  };

  const handleSave = async () => {
    if (!formData.formId.trim()) {
      setSystemAlert('不良品單號不能為空！');
      return;
    }
    try {
      // If editing, first delete all existing items with this formId
      if (editingId) {
        const existingItems = defects.filter(d => d.formId === formData.formId);
        for (const item of existingItems) {
          if (item.id) await deleteDocument('defects', item.id);
        }
      }
      
      // Add all items as new documents
      for (const item of formData.items) {
        if (!item.materialId.trim()) continue; // Skip empty items
        await addDocument('defects', {
          formId: formData.formId.trim(),
          date: formData.date,
          discoverer: formData.discoverer,
          materialId: item.materialId,
          materialName: item.materialName,
          category: item.category || '未分類',
          headType: item.headType || '',
          condition: item.condition,
          quantity: item.quantity === '' ? 0 : Number(item.quantity),
          workOrder: item.workOrder,
          workOrderQuantity: item.workOrderQuantity === '' ? 0 : Number(item.workOrderQuantity),
          createdAt: new Date().toISOString()
        });
      }
      setIsOpen(false);
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (formId: string) => {
    const existingItems = defects.filter(d => d.formId === formId);
    for (const item of existingItems) {
      if (item.id) await deleteDocument('defects', item.id);
    }
    setDeleteConfirmFormId(null);
    loadData();
  };
  
  const openNewForm = () => {
    setFormData({
      formId: '',
      date: new Date().toISOString().split('T')[0],
      discoverer: '',
      items: [{ ...defaultItem }]
    });
    setEditingId(null);
    setIsOpen(true);
  };
  
  const handleEdit = (defectGroup: DefectFormState) => {
    setFormData(defectGroup);
    // Use formId as the editingId to indicate we are in edit mode
    setEditingId(defectGroup.formId);
    setIsOpen(true);
  };

  const groupedForms = useMemo(() => {
    const formsMap = new Map<string, DefectFormState>();
    
    defects.forEach(d => {
      if (!formsMap.has(d.formId)) {
        formsMap.set(d.formId, {
          formId: d.formId,
          date: d.date,
          discoverer: d.discoverer,
          items: []
        });
      }
      const form = formsMap.get(d.formId)!;
      const mat = materials.find(m => m.name === d.materialId);
      form.items.push({
        id: d.id,
        materialId: d.materialId,
        materialName: d.materialName,
        category: d.category || mat?.category || '',
        headType: d.headType || mat?.headType || '',
        condition: d.condition,
        quantity: d.quantity ?? '',
        workOrder: d.workOrder || '',
        workOrderQuantity: d.workOrderQuantity ?? ''
      });
    });

    return Array.from(formsMap.values());
  }, [defects, materials]);

  const filteredForms = groupedForms.filter(f => {
    if (filterStartDate && f.date < filterStartDate) return false;
    if (filterEndDate && f.date > filterEndDate) return false;
    if (filterDiscoverer !== 'all' && f.discoverer !== filterDiscoverer) return false;
    
    // Check items for material/condition filters
    if (filterMaterialId || filterMaterialName || filterCondition) {
      const hasMatchingItem = f.items.some(item => {
        let match = true;
        if (filterMaterialId && !item.materialId.toLowerCase().includes(filterMaterialId.toLowerCase())) match = false;
        if (filterMaterialName && !item.materialName.toLowerCase().includes(filterMaterialName.toLowerCase())) match = false;
        if (filterCondition && !item.condition.toLowerCase().includes(filterCondition.toLowerCase())) match = false;
        return match;
      });
      if (!hasMatchingItem) return false;
    }
    
    return true;
  }).sort((a, b) => {
    let comparison = 0;
    // For materialId and materialName, we sort by the first item's properties
    const valA = sortField === 'materialId' || sortField === 'materialName' 
      ? (a.items[0]?.[sortField as keyof DefectItemState] || '') 
      : (a[sortField as keyof DefectFormState] || '');
      
    const valB = sortField === 'materialId' || sortField === 'materialName' 
      ? (b.items[0]?.[sortField as keyof DefectItemState] || '') 
      : (b[sortField as keyof DefectFormState] || '');

    if (valA > valB) comparison = 1;
    if (valA < valB) comparison = -1;
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const totalPages = Math.ceil(filteredForms.length / pageSize) || 1;
  const paginatedData = filteredForms.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="container mx-auto p-4 max-w-7xl relative">
      <Dialog open={!!deleteConfirmFormId} onOpenChange={(open) => !open && setDeleteConfirmFormId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認刪除</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            確定要刪除不良品單號 [{deleteConfirmFormId}] 嗎？此動作無法復原。
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmFormId(null)}>取消</Button>
            <Button variant="destructive" onClick={() => { if(deleteConfirmFormId) handleDelete(deleteConfirmFormId); }}>確認刪除</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!systemAlert} onOpenChange={(open) => !open && setSystemAlert(null)}>
        <DialogContent className="max-w-sm sm:max-w-sm [&>button]:hidden">
          <div className="flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <DialogTitle className="text-lg font-bold text-slate-900 m-0">系統提示</DialogTitle>
            </div>
            <p className="text-slate-600 mb-6 pl-13">{systemAlert}</p>
            <div className="flex justify-end">
              <Button onClick={() => setSystemAlert(null)} className="bg-blue-600 hover:bg-blue-700">我知道了</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={itemToDelete !== null} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <DialogContent className="max-w-sm sm:max-w-sm [&>button]:hidden">
          <div className="flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
              <DialogTitle className="text-lg font-bold text-slate-900 m-0">確認刪除</DialogTitle>
            </div>
            <p className="text-slate-600 mb-6 pl-13">確定要刪除此不良品項目嗎？(項目 #{itemToDelete !== null ? itemToDelete + 1 : ''})</p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setItemToDelete(null)}>取消</Button>
              <Button variant="destructive" onClick={() => {
                if (itemToDelete === null) return;
                const newItems = [...formData.items];
                newItems.splice(itemToDelete, 1);
                setFormData({...formData, items: newItems});
                setItemToDelete(null);
              }}>確定刪除</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-primary">不良品管理</h1>
        <Dialog open={isOpen} onOpenChange={(open) => {
          if (!open) setIsOpen(false);
        }}>
          <DialogTrigger asChild>
            <Button onClick={openNewForm} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" /> 新增不良品單
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>{editingId ? '編輯不良品單' : '新增不良品單'}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-3 gap-4 py-4 border-b">
              <div className="space-y-2">
                <Label>不良品單號</Label>
                <Input value={formData.formId} disabled={!!editingId} onChange={e => setFormData({...formData, formId: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>日期</Label>
                <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} onClick={(e: any) => e.target.showPicker?.()} />
              </div>
              <div className="space-y-2">
                <Label>發現人員</Label>
                <Select value={formData.discoverer} onValueChange={val => setFormData({...formData, discoverer: val})}>
                  <SelectTrigger><SelectValue placeholder="選擇發現人員" /></SelectTrigger>
                  <SelectContent>
                    {staffList.filter(s => s.permissions?.includes('移印') || s.permissions?.includes('品檢')).map(s => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-4 py-2">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg">不良品項目 <span className="text-sm font-normal text-muted-foreground">(共 {formData.items.length} 項)</span></h3>
                <Button variant="outline" size="sm" onClick={() => {
                  setFormData({...formData, items: [...formData.items, { ...defaultItem }]});
                  setTimeout(() => {
                    document.getElementById(`defective-item-${formData.items.length}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 100);
                }}>
                  <Plus className="w-4 h-4 mr-1" /> 新增項目
                </Button>
              </div>
              
              {formData.items.map((item, index) => (
                  <Card key={index} id={`defective-item-${index}`} className="relative overflow-hidden">
                    <div className="absolute top-0 left-0 bg-slate-200 text-slate-700 font-bold px-2 py-0.5 text-xs rounded-br-lg z-10 border-b border-r border-slate-300">
                      #{index + 1}
                    </div>
                    {formData.items.length > 1 && (
                      <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8 rounded-md shadow-sm z-20" onClick={() => setItemToDelete(index)}>
                        <X className="w-5 h-5 stroke-[3px]" />
                      </Button>
                    )}
                    <CardContent className="p-4 pt-8 grid grid-cols-12 gap-3">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">物料分類</Label>
                      <Select value={item.category} onValueChange={(val) => {
                        const newItems = [...formData.items];
                        newItems[index].category = val;
                        newItems[index].materialId = '';
                        newItems[index].materialName = '';
                        setFormData({...formData, items: newItems});
                      }}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="分類" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="未分類">未分類</SelectItem>
                          <SelectItem value="TKW">TKW</SelectItem>
                          <SelectItem value="夾鉗">夾鉗</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs">物料品號</Label>
                      <Input 
                        list={`mat-id-${index}`}
                        value={item.materialId}
                        className="h-8 text-xs"
                        onChange={e => {
                          const val = e.target.value;
                          const mat = materials.find(m => {
                            const compositeId = `${m.name}${m.headType ? " (" + m.headType + ")" : ""}`;
                            return compositeId === val || m.name === val;
                          });
                          const newItems = [...formData.items];
                          newItems[index].materialId = mat ? mat.name : val;
                          newItems[index].materialName = mat ? (mat.partName || mat.name) : newItems[index].materialName;
                          if (mat?.headType) newItems[index].headType = mat.headType;
                          setFormData({...formData, items: newItems});
                        }}
                        placeholder="輸入/選擇品號"
                      />
                      <datalist id={`mat-id-${index}`}>
                        {materials.filter(m => (!item.category || m.category === item.category) && (!item.headType || item.headType === '其他' || m.headType === item.headType)).map(m => (
                          <option key={m.id} value={`${m.name}${m.headType ? " (" + m.headType + ")" : ""}`} />
                        ))}
                      </datalist>
                    </div>
                    
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs">物料品名</Label>
                      <Input 
                        list={`mat-name-${index}`}
                        value={item.materialName}
                        className="h-8 text-xs"
                        onChange={e => {
                          const val = e.target.value;
                          const mat = materials.find(m => {
                            const compositeName = `${m.partName || m.name}${m.headType ? " (" + m.headType + ")" : ""}`;
                            return compositeName === val || m.partName === val || m.name === val;
                          });
                          const newItems = [...formData.items];
                          newItems[index].materialName = mat ? (mat.partName || mat.name) : val;
                          newItems[index].materialId = mat ? mat.name : newItems[index].materialId;
                          if (mat?.headType) newItems[index].headType = mat.headType;
                          setFormData({...formData, items: newItems});
                        }}
                        placeholder="輸入/選擇品名"
                      />
                      <datalist id={`mat-name-${index}`}>
                        {materials.filter(m => (!item.category || m.category === item.category) && (!item.headType || item.headType === '其他' || m.headType === item.headType)).map(m => (
                          <option key={m.id} value={`${m.partName || m.name}${m.headType ? " (" + m.headType + ")" : ""}`} />
                        ))}
                      </datalist>
                    </div>

                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">頭型</Label>
                      <Select value={item.headType} onValueChange={(val) => {
                        const newItems = [...formData.items];
                        newItems[index].headType = val;
                        setFormData({...formData, items: newItems});
                      }}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="頭型" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A型">A型</SelectItem>
                          <SelectItem value="B型">B型</SelectItem>
                          <SelectItem value="C型">C型</SelectItem>
                          <SelectItem value="其他">其他</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">不良品數量</Label>
                      <Input type="number" min="0" value={item.quantity} onChange={e => {
                        const newItems = [...formData.items];
                        newItems[index].quantity = e.target.value ? Number(e.target.value) : '';
                        setFormData({...formData, items: newItems});
                      }} className="h-8 text-xs" placeholder="數量" />
                    </div>
                    
                    <div className="col-span-6 space-y-1 relative">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs">不良情況</Label>
                        <Button variant="ghost" size="sm" className="h-4 px-1 text-[10px]" onClick={() => setActivePhraseIndex(activePhraseIndex === index ? null : index)}>
                          <ListPlus className="w-3 h-3 mr-1" /> 常用內容
                        </Button>
                      </div>
                      <Input value={item.condition} onChange={e => {
                        const newItems = [...formData.items];
                        newItems[index].condition = e.target.value;
                        setFormData({...formData, items: newItems});
                      }} className="h-8 text-xs" placeholder="描述不良情況" />
                      
                      {activePhraseIndex === index && (
                        <div className="absolute right-0 top-12 z-20 w-64 bg-white border rounded-md shadow-lg p-2">
                          <div className="flex gap-2 mb-2">
                            <Input value={newPhrase} onChange={e => setNewPhrase(e.target.value)} placeholder="新增常用內容..." className="h-7 text-xs" />
                            <Button size="sm" onClick={addPhrase} className="h-7 px-2">新增</Button>
                          </div>
                          <div className="max-h-40 overflow-y-auto space-y-1">
                            {phrases.map((p, i) => (
                              <div key={i} className="flex justify-between items-center bg-slate-50 p-1 rounded group">
                                {editingPhraseIndex === i ? (
                                  <Input 
                                    value={editPhraseText} 
                                    onChange={e => setEditPhraseText(e.target.value)} 
                                    onKeyDown={e => { if (e.key === "Enter") handleSaveEditPhrase(); }} 
                                    autoFocus
                                    className="h-7 text-xs flex-1"
                                  />
                                ) : (
                                  <span className="text-xs cursor-pointer flex-1" onClick={() => {
                                    const newItems = [...formData.items];
                                    newItems[index].condition = newItems[index].condition ? newItems[index].condition + '，' + p : p;
                                    setFormData({...formData, items: newItems});
                                    setActivePhraseIndex(null);
                                  }}>{i + 1}. {p}</span>
                                )}
                                <div className="flex gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {editingPhraseIndex === i ? (
                                    <>
                                      <Button variant="ghost" size="icon" className="h-5 w-5 text-green-600" onClick={handleSaveEditPhrase}>
                                        <Check className="w-3 h-3" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground" onClick={() => setEditingPhraseIndex(null)}>
                                        <X className="w-3 h-3" />
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button variant="ghost" size="icon" className="h-5 w-5 text-blue-600" onClick={() => { setEditingPhraseIndex(i); setEditPhraseText(p); }}>
                                        <Pencil className="w-3 h-3" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-5 w-5 text-red-500" onClick={() => removePhrase(p)}>
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs">製令編號</Label>
                      <Input value={item.workOrder} onChange={e => {
                        const newItems = [...formData.items];
                        newItems[index].workOrder = e.target.value;
                        setFormData({...formData, items: newItems});
                      }} className="h-8 text-xs" placeholder="製令編號" />
                    </div>
                    
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs">製令數量</Label>
                      <Input type="number" min="0" value={item.workOrderQuantity} onChange={e => {
                        const newItems = [...formData.items];
                        newItems[index].workOrderQuantity = e.target.value ? Number(e.target.value) : '';
                        setFormData({...formData, items: newItems});
                      }} className="h-8 text-xs" placeholder="製令數量" />
                    </div>

                    <div className="col-span-12 flex justify-end gap-2 mt-1 pt-3 border-t border-slate-100">
                      <Button variant="outline" size="sm" className="h-6 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2" onClick={() => {
                        const newItems = [...formData.items];
                        newItems.splice(index + 1, 0, { ...newItems[index] });
                        setFormData({ ...formData, items: newItems });
                        setTimeout(() => {
                          document.getElementById(`defective-item-${index + 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 100);
                      }}>
                        <Copy className="w-3 h-3 mr-1" /> 複製此項目
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2" onClick={() => {
                        const newItems = [...formData.items];
                        newItems[index] = { ...defaultItem };
                        setFormData({ ...formData, items: newItems });
                      }}>
                        清除此項目資料
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="flex justify-end items-center mt-4 pt-4 border-t gap-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>取消</Button>
              <Button onClick={handleSave}>儲存</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-4 p-4 border-b bg-muted/10">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Label>日期(起):</Label>
                <Input type="date" value={filterStartDate} onChange={e => {setFilterStartDate(e.target.value); setPage(1);}} className="w-32 h-8 text-xs" onClick={(e: any) => e.target.showPicker?.()} />
              </div>
              <div className="flex items-center gap-2">
                <Label>日期(迄):</Label>
                <Input type="date" value={filterEndDate} onChange={e => {setFilterEndDate(e.target.value); setPage(1);}} className="w-32 h-8 text-xs" onClick={(e: any) => e.target.showPicker?.()} />
              </div>
              <div className="flex items-center gap-2">
                <Label>品號:</Label>
                <Input value={filterMaterialId} onChange={e => {setFilterMaterialId(e.target.value); setPage(1);}} className="w-32 h-8 text-xs" placeholder="關鍵字..." />
              </div>
              <div className="flex items-center gap-2">
                <Label>品名:</Label>
                <Input value={filterMaterialName} onChange={e => {setFilterMaterialName(e.target.value); setPage(1);}} className="w-32 h-8 text-xs" placeholder="關鍵字..." />
              </div>
              <div className="flex items-center gap-2">
                <Label>不良情況:</Label>
                <Input value={filterCondition} onChange={e => {setFilterCondition(e.target.value); setPage(1);}} className="w-32 h-8 text-xs" placeholder="關鍵字..." />
              </div>
              <div className="flex items-center gap-2 border-l pl-4 border-muted-foreground/20">
                <Label>發現人員:</Label>
                <Select value={filterDiscoverer} onValueChange={val => {setFilterDiscoverer(val); setPage(1);}}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    {staffList.filter(s => s.permissions?.includes('移印') || s.permissions?.includes('品檢')).map(s => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => {
                setFilterStartDate(''); setFilterEndDate(''); setFilterMaterialId(''); setFilterMaterialName(''); setFilterDiscoverer('all'); setFilterCondition(''); setPage(1);
              }}>清除</Button>
            </div>
          </div>
          <div className="flex justify-between items-center p-4 border-b bg-muted/20">
            <div className="font-bold flex items-center gap-4">
              不良品單列表
              <div className="text-sm font-normal text-muted-foreground">符合條件共 {filteredForms.length} 筆資料</div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-8">上一頁</Button>
                <span className="text-sm">第 {page} / {totalPages} 頁</span>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-8">下一頁</Button>
              </div>
              <div className="flex items-center gap-2 border-l pl-4">
                <Label>排序:</Label>
                <Select value={sortField} onValueChange={(val: any) => { setSortField(val); setPage(1); }}>
                  <SelectTrigger className="w-24 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="formId">依單號</SelectItem>
                    <SelectItem value="date">依日期</SelectItem>
                    <SelectItem value="materialId">依品號</SelectItem>
                    <SelectItem value="materialName">依品名</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortOrder} onValueChange={(val: any) => { setSortOrder(val); setPage(1); }}>
                  <SelectTrigger className="w-24 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">由小到大</SelectItem>
                    <SelectItem value="desc">由大到小</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 border-l pl-4">
                <Label>每頁筆數:</Label>
                <Select value={pageSize.toString()} onValueChange={(val) => { setPageSize(parseInt(val)); setPage(1); }}>
                  <SelectTrigger className="w-[80px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">操作</TableHead>
                <TableHead className="w-16">序號</TableHead>
                <TableHead className="w-32">單號</TableHead>
                <TableHead className="w-32">日期</TableHead>
                <TableHead className="w-24">發現人員</TableHead>
                <TableHead className="w-24 text-center">項目總數</TableHead>
                <TableHead>不良品內容</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center h-24">載入中...</TableCell></TableRow>
              ) : paginatedData.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center h-24">尚無不良品單記錄</TableCell></TableRow>
              ) : (
                paginatedData.map((form, index) => {
                  return (
                    <TableRow key={form.formId}>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(form)}>編輯</Button>
                          <Button variant="destructive" size="sm" onClick={() => setDeleteConfirmFormId(form.formId)}>刪除</Button>
                        </div>
                      </TableCell>
                      <TableCell>{(page - 1) * pageSize + index + 1}</TableCell>
                      <TableCell className="font-bold">{form.formId}</TableCell>
                      <TableCell>{form.date}</TableCell>
                      <TableCell>{form.discoverer}</TableCell>
                      <TableCell className="text-center font-bold text-red-600 text-lg">{form.items.length}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5 py-1">
                          {form.items.map((item, idx) => (
                            <div key={idx} className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded shadow-sm">{item.materialId}</span>
                              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded shadow-sm">{item.materialName}</span>
                              {item.headType && (
                                <span className={`px-1.5 py-0.5 text-[10px] rounded font-bold border ${item.headType === 'A型' ? 'bg-purple-100 text-purple-700 border-purple-200' : item.headType === 'B型' ? 'bg-pink-100 text-pink-700 border-pink-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                  {item.headType}
                                </span>
                              )}
                              <span className="text-xs text-red-600 font-bold bg-red-50 px-1.5 py-0.5 border border-red-100 rounded">不良 {item.quantity || 0} PCS</span>
                              {item.workOrder && <span className="text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 border border-slate-200 rounded">製令: {item.workOrder} ({item.workOrderQuantity})</span>}
                              {item.condition && <span className="text-xs text-muted-foreground">({item.condition})</span>}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          <div className="flex justify-between items-center p-4 border-t">
            <div className="text-sm text-muted-foreground">符合條件共 {filteredForms.length} 筆資料</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>上一頁</Button>
              <span className="text-sm">第 {page} / {totalPages} 頁</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>下一頁</Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* 內建的小工具可以直接在這裡引入嗎？ 
          使用者說：請在系統畫面的左方，增加一個"品號查詢"的小工具。
          所以最好是放在 App.tsx，這樣所有頁面都看得到。 */}
    </div>
  );
}
