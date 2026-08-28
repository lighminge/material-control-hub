import { useState, useEffect } from 'react';
import { getCollection, addDocument, updateDocument, deleteDocument, getDocument, setDocumentWithId } from '@/lib/firebase/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, X, ListPlus, Pencil, Check, Trash2 } from 'lucide-react';

export type Defect = {
  id?: string;
  formId: string;
  date: string;
  materialId: string;
  materialName: string;
  condition: string;
  discoverer: string;
  createdAt?: string;
};

export default function DefectivePage() {
  const [defects, setDefects] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<Defect>({
    formId: '',
    date: new Date().toISOString().split('T')[0],
    materialId: '',
    materialName: '',
    condition: '',
    discoverer: ''
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Quick Phrases
  const [phrases, setPhrases] = useState<string[]>([]);
  const [showPhrases, setShowPhrases] = useState(false);
  const [newPhrase, setNewPhrase] = useState('');
  const [editingPhraseIndex, setEditingPhraseIndex] = useState<number | null>(null);
  const [editPhraseText, setEditPhraseText] = useState('');
  
  const [systemAlert, setSystemAlert] = useState<string | null>(null);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getCollection('defects');
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
    savePhrases(phrases.filter(p => p !== phrase));
  };

  const handleSave = async () => {
    if (!formData.formId.trim()) {
      setSystemAlert('不良品單號不能為空！');
      return;
    }
    try {
      if (editingId) {
        await updateDocument('defects', editingId, formData);
      } else {
        await addDocument('defects', { ...formData, createdAt: new Date().toISOString() });
      }
      setIsOpen(false);
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('確定要刪除這筆不良品單嗎？')) {
      await deleteDocument('defects', id);
      loadData();
    }
  };
  
  const openNewForm = () => {
    setFormData({
      formId: '',
      date: new Date().toISOString().split('T')[0],
      materialId: '',
      materialName: '',
      condition: '',
      discoverer: ''
    });
    setEditingId(null);
    setIsOpen(true);
  };
  
  const handleEdit = (defect: Defect) => {
    setFormData(defect);
    setEditingId(defect.id!);
    setIsOpen(true);
  };

  const totalPages = Math.ceil(defects.length / pageSize) || 1;
  const paginatedData = defects.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="container mx-auto p-4 max-w-7xl relative">
      {systemAlert && (
        <div className="fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-md shadow-lg z-50 flex justify-between items-center min-w-[300px]">
          <span>{systemAlert}</span>
          <button onClick={() => setSystemAlert(null)} className="ml-4 hover:bg-red-600 rounded-full p-1"><X size={16} /></button>
        </div>
      )}

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
          <DialogContent className="max-w-xl" onPointerDownOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>{editingId ? '編輯不良品單' : '新增不良品單'}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>不良品單號</Label>
                <Input value={formData.formId} onChange={e => setFormData({...formData, formId: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>日期</Label>
                <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>物料品號</Label>
                <Input value={formData.materialId} onChange={e => setFormData({...formData, materialId: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>物料品名</Label>
                <Input value={formData.materialName} onChange={e => setFormData({...formData, materialName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>發現人員</Label>
                <Input value={formData.discoverer} onChange={e => setFormData({...formData, discoverer: e.target.value})} />
              </div>
              <div className="col-span-2 space-y-2 relative">
                <div className="flex justify-between items-center">
                  <Label>不良情況</Label>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setShowPhrases(!showPhrases)}>
                    <ListPlus className="w-3 h-3 mr-1" /> 常用內容
                  </Button>
                </div>
                {showPhrases && (
                  <div className="absolute right-0 top-6 z-10 w-64 bg-white border rounded-md shadow-lg p-2">
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
                              onKeyDown={e => { if (e.key === 'Enter') handleSaveEditPhrase(); }} 
                              autoFocus
                              className="h-7 text-xs flex-1"
                            />
                          ) : (
                            <span className="text-xs cursor-pointer flex-1" onClick={() => {
                              setFormData({...formData, condition: formData.condition ? formData.condition + '，' + p : p});
                              setShowPhrases(false);
                            }}>{p}</span>
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
                                <Button variant="ghost" size="icon" className="h-5 w-5 text-blue-600" onClick={() => {
                                  setEditingPhraseIndex(i);
                                  setEditPhraseText(p);
                                }}>
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
                <Input value={formData.condition} onChange={e => setFormData({...formData, condition: e.target.value})} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setIsOpen(false)}>取消</Button>
              <Button onClick={handleSave}>儲存</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
      <Card>
        <CardContent className="p-0">
          <div className="flex justify-between items-center p-4 border-b bg-muted/20">
            <div className="font-bold flex items-center gap-4">
              不良品單列表
              <div className="text-sm font-normal text-muted-foreground">總共 {defects.length} 筆資料</div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-8">上一頁</Button>
                <span className="text-sm">第 {page} / {totalPages} 頁</span>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-8">下一頁</Button>
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
                <TableHead>單號</TableHead>
                <TableHead>日期</TableHead>
                <TableHead>物料品號</TableHead>
                <TableHead>物料品名</TableHead>
                <TableHead>發現人員</TableHead>
                <TableHead>不良情況</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center h-24">載入中...</TableCell></TableRow>
              ) : paginatedData.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center h-24">尚無不良品單記錄</TableCell></TableRow>
              ) : (
                paginatedData.map(defect => (
                  <TableRow key={defect.id}>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(defect)}>編輯</Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(defect.id!)}>刪除</Button>
                      </div>
                    </TableCell>
                    <TableCell className="font-bold">{defect.formId}</TableCell>
                    <TableCell>{defect.date}</TableCell>
                    <TableCell><span className="font-mono bg-slate-100 px-2 py-1 rounded">{defect.materialId}</span></TableCell>
                    <TableCell><span className="font-bold text-indigo-700">{defect.materialName}</span></TableCell>
                    <TableCell>{defect.discoverer}</TableCell>
                    <TableCell>{defect.condition}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <div className="flex justify-between items-center p-4 border-t">
            <div className="text-sm text-muted-foreground">總共 {defects.length} 筆資料</div>
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
