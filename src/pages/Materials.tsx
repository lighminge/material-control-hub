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
};

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [formData, setFormData] = useState<Material>({
    name: '',
    stock: 0,
    unit: '個'
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
      setFormData({ name: '', stock: 0, unit: '個' });
      setEditingId(null);
    } catch (error) {
      console.error("Error saving material:", error);
    }
  };

  const handleEdit = (mat: Material) => {
    setFormData(mat);
    setEditingId(mat.id || null);
    setIsOpen(true);
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    await deleteDocument('materials', id);
    setDeleteConfirmId(null);
    loadMaterials();
  };

  const openNewForm = () => {
    setFormData({ name: '', stock: 0, unit: 'PCS' });
    setEditingId(null);
    setIsOpen(true);
  };

  const totalItems = materials.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedData = materials.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認刪除</DialogTitle>
          </DialogHeader>
          <div className="py-4">您確定要刪除此物料嗎？此動作無法復原。</div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>取消</Button>
            <Button variant="destructive" onClick={() => { if(deleteConfirmId) handleDelete(deleteConfirmId); }}>確認刪除</Button>
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

      <div className="flex justify-between items-center bg-muted/50 p-4 rounded-md">
        <div className="font-medium">總計: {totalItems} 筆資料</div>
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
                <TableHead>物料品號</TableHead>
                <TableHead>庫存數量</TableHead>
                <TableHead>單位</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">載入中...</TableCell>
                </TableRow>
              ) : paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">尚無物料資料</TableCell>
                </TableRow>
              ) : (
                paginatedData.map((mat, index) => (
                  <TableRow key={mat.id}>
                    <TableCell>
                      <div className="flex flex-row gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(mat)}>編輯</Button>
                        <Button variant="destructive" size="sm" onClick={() => setDeleteConfirmId(mat.id!)}>刪除</Button>
                      </div>
                    </TableCell>
                    <TableCell>{(page - 1) * pageSize + index + 1}</TableCell>
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
