import { useState, useEffect } from 'react';
import { getCollection, addDocument, updateDocument, deleteDocument } from '@/lib/firebase/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  
  const [sortBy, setSortBy] = useState<'asc' | 'desc' | 'none'>('none');

  const [formData, setFormData] = useState<Material>({
    name: '',
    stock: 0,
    unit: 'PCS',
    category: '未分類'
  });

  const loadMaterials = async () => {
    setLoading(true);
    try {
      const data = await getCollection('materials') as Material[];
      setMaterials(data);
    } catch (error) {
      console.error("Error loading materials:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaterials();
  }, []);

  const handleSave = async () => {
    try {
      if (editingId) {
        await updateDocument('materials', editingId, formData);
      } else {
        await addDocument('materials', formData);
      }
      setIsOpen(false);
      loadMaterials();
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
    loadMaterials();
  };

  const openNewForm = () => {
    setFormData({ name: '', stock: 0, unit: 'PCS', category: '未分類' });
    setEditingId(null);
    setIsOpen(true);
  };

  // Sort logic
  const sortedMaterials = [...materials];
  if (sortBy === 'asc') {
    sortedMaterials.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === 'desc') {
    sortedMaterials.sort((a, b) => b.name.localeCompare(a.name));
  }

  const totalItems = sortedMaterials.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedData = sortedMaterials.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
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

      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-primary">物料庫存</h1>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNewForm}>新增物料</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? '編輯物料' : '新增物料'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>物料品號</Label>
                <Input 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
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
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center bg-muted/50 p-4 rounded-md gap-4">
        <div className="flex items-center gap-4">
          <div className="font-medium">總計: {totalItems} 筆資料</div>
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
              </SelectContent>
            </Select>
          </div>
        </div>
        
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
                    <TableCell className="text-muted-foreground">{mat.category || '未分類'}</TableCell>
                    <TableCell className="font-medium">{mat.name}</TableCell>
                    <TableCell>{mat.stock}</TableCell>
                    <TableCell>{mat.unit}</TableCell>
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
