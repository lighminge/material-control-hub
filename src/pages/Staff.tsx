import { useState, useEffect } from 'react';
import { getCollection, addDocument, updateDocument, deleteDocument } from '@/lib/firebase/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

type Staff = {
  id?: string;
  name: string;
  gender: string;
  title: string;
  notes: string;
  permissions?: string[];
};

export default function StaffPage() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const [formData, setFormData] = useState<Staff>({
    name: '',
    gender: '男',
    title: '',
    notes: '',
    permissions: []
  });

  const loadStaff = async () => {
    setLoading(true);
    try {
      const data = await getCollection('staff') as Staff[];
      setStaffList(data);
    } catch (error) {
      console.error("Error loading staff:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleSave = async () => {
    try {
      if (editingId) {
        await updateDocument('staff', editingId, formData);
      } else {
        await addDocument('staff', formData);
      }
      setIsOpen(false);
      loadStaff();
      setFormData({ name: '', gender: '男', title: '', notes: '', permissions: [] });
      setEditingId(null);
    } catch (error) {
      console.error("Error saving staff:", error);
    }
  };

  const handleEdit = (staff: Staff) => {
    setFormData(staff);
    setEditingId(staff.id || null);
    setIsOpen(true);
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    await deleteDocument('staff', id);
    setDeleteConfirmId(null);
    loadStaff();
  };

  const openNewForm = () => {
    setFormData({ name: '', gender: '男', title: '', notes: '', permissions: [] });
    setEditingId(null);
    setIsOpen(true);
  };

  const totalItems = staffList.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedData = staffList.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認刪除</DialogTitle>
          </DialogHeader>
          <div className="py-4">您確定要刪除此人員嗎？此動作無法復原。</div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>取消</Button>
            <Button variant="destructive" onClick={() => { if(deleteConfirmId) handleDelete(deleteConfirmId); }}>確認刪除</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold tracking-tight text-primary">人員管理</h1>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewForm}>新增人員</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? '編輯人員' : '新增人員'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>姓名</Label>
                  <Input 
                    value={formData.name} 
                    onChange={(e) => setFormData({...formData, name: e.target.value})} 
                    placeholder="輸入姓名"
                  />
                </div>
                <div className="space-y-2">
                  <Label>性別</Label>
                  <Select value={formData.gender} onValueChange={(val) => setFormData({...formData, gender: val})}>
                    <SelectTrigger>
                      <SelectValue placeholder="選擇性別" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="男">男</SelectItem>
                      <SelectItem value="女">女</SelectItem>
                      <SelectItem value="其他">其他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>職稱</Label>
                  <Input 
                    value={formData.title} 
                    onChange={(e) => setFormData({...formData, title: e.target.value})} 
                    placeholder="輸入職稱"
                  />
                </div>
                <div className="space-y-2">
                  <Label>備註</Label>
                  <Input 
                    value={formData.notes} 
                    onChange={(e) => setFormData({...formData, notes: e.target.value})} 
                    placeholder="其他備註"
                  />
                </div>
                <div className="space-y-2">
                  <Label>權限</Label>
                  <div className="flex gap-4 pt-1">
                    {['備料', '移印', '品檢'].map(perm => (
                      <div key={perm} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`perm-${perm}`} 
                          checked={formData.permissions?.includes(perm) || false}
                          onCheckedChange={(checked) => {
                            const current = formData.permissions || [];
                            if (checked) {
                              setFormData({...formData, permissions: [...current, perm]});
                            } else {
                              setFormData({...formData, permissions: current.filter(p => p !== perm)});
                            }
                          }}
                        />
                        <label htmlFor={`perm-${perm}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                          {perm}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                <Button className="w-full" onClick={handleSave}>儲存</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
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
                <SelectItem value="5">5 筆</SelectItem>
                <SelectItem value="10">10 筆</SelectItem>
                <SelectItem value="15">15 筆</SelectItem>
                <SelectItem value="20">20 筆</SelectItem>
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
                <TableHead>姓名</TableHead>
                <TableHead>性別</TableHead>
                <TableHead>職稱</TableHead>
                <TableHead>權限</TableHead>
                <TableHead>備註</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24">載入中...</TableCell>
                </TableRow>
              ) : paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24">尚無人員資料</TableCell>
                </TableRow>
              ) : (
                paginatedData.map((staff, index) => (
                  <TableRow key={staff.id}>
                    <TableCell>
                      <div className="flex flex-row gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(staff)}>編輯</Button>
                        <Button variant="destructive" size="sm" onClick={() => setDeleteConfirmId(staff.id!)}>刪除</Button>
                      </div>
                    </TableCell>
                    <TableCell>{(page - 1) * pageSize + index + 1}</TableCell>
                    <TableCell className="font-medium">{staff.name}</TableCell>
                    <TableCell>{staff.gender}</TableCell>
                    <TableCell>{staff.title}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {staff.permissions?.map(p => (
                          <span key={p} className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">{p}</span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{staff.notes}</TableCell>
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
