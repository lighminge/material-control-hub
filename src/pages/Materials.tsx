import { useState, useEffect } from 'react';
import { getCollection, addDocument, updateDocument, deleteDocument } from '@/lib/firebase/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as XLSX from 'xlsx';

export type Material = {
  id?: string;
  name: string;
  stock: number;
  unit: string;
  category?: string;
};

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<Material | null>(null);
  const [systemAlert, setSystemAlert] = useState<string | null>(null);
  
  const [sortBy, setSortBy] = useState<'asc' | 'desc' | 'cat_asc' | 'cat_desc' | 'none'>('asc');
  const [searchName, setSearchName] = useState('');
  const [searchCategory, setSearchCategory] = useState('all');

  const [formData, setFormData] = useState<Material>({
    name: '',
    stock: 0,
    unit: 'PCS',
    category: '未分類'
  });

  // History Tab State
  const [activeTab, setActiveTab] = useState<'list' | 'history'>('list');
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  
  const [histSearchName, setHistSearchName] = useState('');
  const [histSearchCat, setHistSearchCat] = useState('all');
  const [histStartDate, setHistStartDate] = useState('');
  const [histEndDate, setHistEndDate] = useState('');
  const [histSort, setHistSort] = useState<'desc' | 'asc'>('desc');
  const [histPage, setHistPage] = useState(1);
  const [histPageSize, setHistPageSize] = useState(10);

  const loadData = async () => {
    setLoading(true);
    try {
      const [matsData, ctrlsData] = await Promise.all([
        getCollection('materials'),
        getCollection('controls')
      ]);
      setMaterials(matsData as Material[]);
      
      const logs: any[] = [];
      (ctrlsData as any[]).forEach(c => {
        (c.items || []).forEach((item: any) => {
          if (item.missingQuantity === 0 && item.restockDate) {
            logs.push({
              id: `${c.id}_${item.materialId}`,
              controlId: c.displayId || c.id?.slice(0, 8),
              materialId: item.materialId,
              materialName: item.materialName,
              restockDate: item.restockDate,
              requiredQuantity: item.requiredQuantity,
              notes: item.notes
            });
          }
        });
      });
      setHistoryLogs(logs);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setSystemAlert('物料品號不能為空白！');
      return;
    }

    const isDuplicate = materials.some(m => m.name.toLowerCase() === formData.name.trim().toLowerCase() && m.id !== editingId);
    if (isDuplicate) {
      setSystemAlert(`系統中已存在相同的物料品號 [${formData.name.trim()}]！`);
      return;
    }

    try {
      if (editingId) {
        await updateDocument('materials', editingId, formData);
      } else {
        await addDocument('materials', formData);
      }
      setIsOpen(false);
      loadData();
      setFormData({ name: '', stock: 0, unit: 'PCS', category: '未分類' });
      setEditingId(null);
    } catch (error) {
      console.error("Error saving material:", error);
    }
  };

  const handleEdit = (mat: Material) => {
    setFormData({ ...mat, category: mat.category || '未分類' });
    setEditingId(mat.id || null);
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deleteDocument('materials', id);
    setDeleteConfirmItem(null);
    loadData();
  };

  const openNewForm = () => {
    setFormData({ name: '', stock: 0, unit: 'PCS', category: '未分類' });
    setEditingId(null);
    setIsOpen(true);
  };

  // Filter logic
  const filteredMaterials = materials.filter(mat => {
    const matchName = searchName === '' || mat.name.toLowerCase().includes(searchName.toLowerCase());
    const matchCategory = searchCategory === 'all' || (mat.category || '未分類') === searchCategory;
    return matchName && matchCategory;
  });

  // Sort logic
  const sortedMaterials = [...filteredMaterials];
  if (sortBy === 'asc') {
    sortedMaterials.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === 'desc') {
    sortedMaterials.sort((a, b) => b.name.localeCompare(a.name));
  } else if (sortBy === 'cat_asc') {
    sortedMaterials.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
  } else if (sortBy === 'cat_desc') {
    sortedMaterials.sort((a, b) => (b.category || '').localeCompare(a.category || ''));
  }

  const totalItems = sortedMaterials.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedData = sortedMaterials.slice((page - 1) * pageSize, page * pageSize);

  // History Filter logic
  const filteredHist = historyLogs.filter(log => {
    const mat = materials.find(m => m.id === log.materialId);
    if (histSearchName && !log.materialName.toLowerCase().includes(histSearchName.toLowerCase())) return false;
    if (histSearchCat !== 'all' && (mat?.category || '未分類') !== histSearchCat) return false;
    if (histStartDate && log.restockDate < histStartDate) return false;
    if (histEndDate && log.restockDate > histEndDate) return false;
    return true;
  });

  filteredHist.sort((a, b) => {
    if (histSort === 'desc') return b.restockDate.localeCompare(a.restockDate);
    return a.restockDate.localeCompare(b.restockDate);
  });

  const histTotalItems = filteredHist.length;
  const histTotalPages = Math.ceil(histTotalItems / histPageSize) || 1;
  const histPaginatedData = filteredHist.slice((histPage - 1) * histPageSize, histPage * histPageSize);

  const handleExportExcel = () => {
    const exportData = filteredHist.map((log, index) => {
      const mat = materials.find(m => m.id === log.materialId);
      return {
        '序號': index + 1,
        '補完日期': log.restockDate,
        '物料分類': mat?.category || '未分類',
        '物料品號': log.materialName,
        '來源管制單號': log.controlId,
        '補完/進貨備註': log.notes || ''
      };
    });
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "庫存變更歷程");
    XLSX.writeFile(wb, `庫存變更歷程_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <Dialog open={!!systemAlert} onOpenChange={(open) => !open && setSystemAlert(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">系統提示</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center font-bold text-lg">{systemAlert}</div>
          <div className="flex justify-center">
            <Button onClick={() => setSystemAlert(null)}>確認</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirmItem} onOpenChange={(open) => !open && setDeleteConfirmItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認刪除物料</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p>您確定要刪除物料品號 <strong>{deleteConfirmItem?.name}</strong> 嗎？此動作無法復原。</p>
            {(deleteConfirmItem?.stock || 0) > 0 && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md border border-destructive/20 font-bold">
                ⚠️ 警告：該物料目前尚有庫存 {deleteConfirmItem?.stock} {deleteConfirmItem?.unit}！刪除後將遺失此庫存資料。
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmItem(null)}>取消</Button>
            <Button variant="destructive" onClick={() => { if(deleteConfirmItem?.id) handleDelete(deleteConfirmItem.id); }}>確認刪除</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-6 bg-muted/30 p-4 rounded-xl border border-border/50">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold tracking-tight text-primary">物料庫存</h1>
          {activeTab === 'list' && (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button onClick={openNewForm}>新增物料</Button>
              </DialogTrigger>
            <DialogContent onInteractOutside={(e) => e.preventDefault()}>
              <DialogHeader>
                <DialogTitle>{editingId ? '編輯物料' : '新增物料'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>物料品號</Label>
                  <Input 
                    value={formData.name} 
                    onChange={(e) => setFormData({...formData, name: e.target.value})} 
                    onBlur={() => {
                      if (formData.name.trim()) {
                        const isDuplicate = materials.some(m => m.name.toLowerCase() === formData.name.trim().toLowerCase() && m.id !== editingId);
                        if (isDuplicate) {
                          setSystemAlert(`系統中已存在相同的物料品號 [${formData.name.trim()}]！`);
                        }
                      }
                    }}
                    placeholder="輸入物料品號"
                  />
                </div>
                <div className="space-y-2">
                  <Label>物料分類</Label>
                  <Select value={formData.category || '未分類'} onValueChange={(val) => setFormData({...formData, category: val})}>
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
                <div className="space-y-2">
                  <Label>庫存數量</Label>
                  <Input 
                    type="number"
                    value={formData.stock} 
                    onChange={(e) => setFormData({...formData, stock: parseInt(e.target.value) || 0})} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>單位</Label>
                  <Select value={formData.unit} onValueChange={(val) => setFormData({...formData, unit: val})}>
                    <SelectTrigger>
                      <SelectValue placeholder="選擇單位" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PCS">PCS</SelectItem>
                      <SelectItem value="KG">KG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={handleSave}>儲存</Button>
              </div>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </div>

      <div className="flex gap-4 border-b">
        <button 
          className={`px-4 py-2 font-bold transition-all border-b-2 ${activeTab === 'list' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          onClick={() => setActiveTab('list')}
        >
          物料清單
        </button>
        <button 
          className={`px-4 py-2 font-bold transition-all border-b-2 ${activeTab === 'history' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          onClick={() => setActiveTab('history')}
        >
          庫存變更歷程
        </button>
      </div>

      {activeTab === 'list' && (
        <>
          <div className="flex flex-col gap-4 bg-muted/50 p-4 rounded-md">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Label>查詢品號:</Label>
                <Input 
                  placeholder="輸入關鍵字..." 
                  value={searchName} 
                  onChange={(e) => { setSearchName(e.target.value); setPage(1); }}
                  className="w-32 h-8 text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label>查詢分類:</Label>
                <Select value={searchCategory} onValueChange={(val) => { setSearchCategory(val); setPage(1); }}>
                  <SelectTrigger className="w-[100px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部分類</SelectItem>
                    <SelectItem value="未分類">未分類</SelectItem>
                    <SelectItem value="TKW">TKW</SelectItem>
                    <SelectItem value="夾鉗">夾鉗</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 border-l pl-4 border-muted-foreground/20">
                <Label>排序:</Label>
                <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
                  <SelectTrigger className="w-[180px] h-8 text-xs">
                    <SelectValue placeholder="選擇排序方式" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">預設排序</SelectItem>
                    <SelectItem value="asc">依物料品號 由小到大</SelectItem>
                    <SelectItem value="desc">依物料品號 由大到小</SelectItem>
                    <SelectItem value="cat_asc">依物料分類 由小到大</SelectItem>
                    <SelectItem value="cat_desc">依物料分類 由大到小</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex items-center gap-4 flex-wrap border-t pt-4 border-muted-foreground/20">
              <div className="font-medium pr-4 border-r border-muted-foreground/20">總計: {totalItems} 筆資料</div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label>每頁顯示:</Label>
                  <Select value={pageSize.toString()} onValueChange={(val) => { setPageSize(parseInt(val)); setPage(1); }}>
                    <SelectTrigger className="w-[80px] h-8 text-xs">
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
          </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">操作</TableHead>
                <TableHead className="w-16">序號</TableHead>
                <TableHead>物料分類</TableHead>
                <TableHead>物料品號</TableHead>
                <TableHead>庫存數量</TableHead>
                <TableHead>單位</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">載入中...</TableCell>
                </TableRow>
              ) : paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">尚無物料資料</TableCell>
                </TableRow>
              ) : (
                paginatedData.map((mat, index) => (
                  <TableRow key={mat.id}>
                    <TableCell>
                      <div className="flex flex-row gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(mat)}>編輯</Button>
                        <Button variant="destructive" size="sm" onClick={() => setDeleteConfirmItem(mat)}>刪除</Button>
                      </div>
                    </TableCell>
                    <TableCell>{(page - 1) * pageSize + index + 1}</TableCell>
                    <TableCell>
                      {mat.category === 'TKW' ? (
                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-xs font-bold border border-blue-200">TKW</span>
                      ) : mat.category === '夾鉗' ? (
                        <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-md text-xs font-bold border border-orange-200">夾鉗</span>
                      ) : (
                        <span className="text-muted-foreground">{mat.category || '未分類'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-base font-bold bg-teal-100 text-teal-800 border border-teal-300 px-3 py-1.5 rounded-md shadow-sm">
                        {mat.name}
                      </span>
                    </TableCell>
                    <TableCell>{mat.stock}</TableCell>
                    <TableCell>{mat.unit}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </>
      )}

      {activeTab === 'history' && (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-center bg-muted/50 p-4 rounded-md gap-4 flex-wrap">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Label>查詢品號:</Label>
                <Input 
                  placeholder="輸入關鍵字..." 
                  value={histSearchName} 
                  onChange={(e) => { setHistSearchName(e.target.value); setHistPage(1); }}
                  className="w-32 h-8 text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label>查詢分類:</Label>
                <Select value={histSearchCat} onValueChange={(val) => { setHistSearchCat(val); setHistPage(1); }}>
                  <SelectTrigger className="w-[100px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部分類</SelectItem>
                    <SelectItem value="未分類">未分類</SelectItem>
                    <SelectItem value="TKW">TKW</SelectItem>
                    <SelectItem value="夾鉗">夾鉗</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label>日期(起):</Label>
                <Input 
                  type="date"
                  value={histStartDate} 
                  onChange={(e) => { setHistStartDate(e.target.value); setHistPage(1); }}
                  className="w-32 h-8 text-xs"
                  style={{ colorScheme: 'light dark' }}
                />
              </div>
              <div className="flex items-center gap-2">
                <Label>日期(迄):</Label>
                <Input 
                  type="date"
                  value={histEndDate} 
                  onChange={(e) => { setHistEndDate(e.target.value); setHistPage(1); }}
                  className="w-32 h-8 text-xs"
                  style={{ colorScheme: 'light dark' }}
                />
              </div>
              <div className="flex items-center gap-2 border-l pl-4 border-muted-foreground/20">
                <Label>日期排序:</Label>
                <Select value={histSort} onValueChange={(val: 'asc'|'desc') => { setHistSort(val); setHistPage(1); }}>
                  <SelectTrigger className="w-[120px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">由大到小 (新到舊)</SelectItem>
                    <SelectItem value="asc">由小到大 (舊到新)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleExportExcel} className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white ml-2">匯出 Excel</Button>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="font-medium">總計: {histTotalItems} 筆資料</div>
              <div className="flex items-center gap-2">
                <Label>每頁顯示:</Label>
                <Select value={histPageSize.toString()} onValueChange={(val) => { setHistPageSize(parseInt(val)); setHistPage(1); }}>
                  <SelectTrigger className="w-[80px] h-8 text-xs">
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
                <Button variant="outline" size="sm" onClick={() => setHistPage(p => Math.max(1, p - 1))} disabled={histPage === 1}>上一頁</Button>
                <span className="text-sm">第 {histPage} / {histTotalPages} 頁</span>
                <Button variant="outline" size="sm" onClick={() => setHistPage(p => Math.min(histTotalPages, p + 1))} disabled={histPage === histTotalPages}>下一頁</Button>
              </div>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">序號</TableHead>
                    <TableHead>補完日期</TableHead>
                    <TableHead>物料分類</TableHead>
                    <TableHead>物料品號</TableHead>
                    <TableHead>來源管制單號</TableHead>
                    <TableHead>補完/進貨備註</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center h-24">載入中...</TableCell>
                    </TableRow>
                  ) : histPaginatedData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center h-24">無符合條件的歷程記錄</TableCell>
                    </TableRow>
                  ) : (
                    histPaginatedData.map((log, index) => {
                      const mat = materials.find(m => m.id === log.materialId);
                      return (
                        <TableRow key={log.id}>
                          <TableCell>{(histPage - 1) * histPageSize + index + 1}</TableCell>
                          <TableCell className="font-bold text-green-700">{log.restockDate}</TableCell>
                          <TableCell>
                            {mat?.category === 'TKW' ? (
                              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-xs font-bold border border-blue-200">TKW</span>
                            ) : mat?.category === '夾鉗' ? (
                              <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-md text-xs font-bold border border-orange-200">夾鉗</span>
                            ) : (
                              <span className="text-muted-foreground">{mat?.category || '未分類'}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-base font-bold bg-teal-100 text-teal-800 border border-teal-300 px-3 py-1.5 rounded-md shadow-sm">
                              {log.materialName}
                            </span>
                          </TableCell>
                          <TableCell>{log.controlId}</TableCell>
                          <TableCell>{log.notes || '-'}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
