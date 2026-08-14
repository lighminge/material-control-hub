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

  const handleDelete = async (id: string) => {
    if (confirm('確定要刪除此物料嗎？')) {
      await deleteDocument('materials', id);
      loadMaterials();
    }
  };

  const openNewForm = () => {
    setFormData({ name: '', stock: 0, unit: '個' });
    setEditingId(null);
    setIsOpen(true);
  };

  const totalItems = materials.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedData = materials.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
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
                <Label>物料名稱</Label>
                <Input 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
                  placeholder="輸入名稱"
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
                <Input 
                  value={formData.unit} 
                  onChange={(e) => setFormData({...formData, unit: e.target.value})} 
                  placeholder="如: 個, 件, 箱"
                />
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
                <TableHead className="w-24">操作</TableHead>
                <TableHead className="w-16">序號</TableHead>
                <TableHead>物料名稱</TableHead>
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
                    <TableCell className="space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(mat)}>編輯</Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(mat.id!)}>刪除</Button>
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
