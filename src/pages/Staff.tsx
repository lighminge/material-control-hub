import { useState, useEffect } from 'react';
import { getCollection, addDocument, updateDocument, deleteDocument } from '@/lib/firebase/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

type Staff = {
  id?: string;
  name: string;
  gender: string;
  title: string;
  notes: string;
};

export default function StaffPage() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Staff>({
    name: '',
    gender: '男',
    title: '',
    notes: ''
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
      setFormData({ name: '', gender: '男', title: '', notes: '' });
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

  const handleDelete = async (id: string) => {
    if (confirm('確定要刪除此人員嗎？')) {
      await deleteDocument('staff', id);
      loadStaff();
    }
  };

  const openNewForm = () => {
    setFormData({ name: '', gender: '男', title: '', notes: '' });
    setEditingId(null);
    setIsOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
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
              <Button className="w-full" onClick={handleSave}>儲存</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>姓名</TableHead>
                <TableHead>性別</TableHead>
                <TableHead>職稱</TableHead>
                <TableHead>備註</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">載入中...</TableCell>
                </TableRow>
              ) : staffList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">尚無人員資料</TableCell>
                </TableRow>
              ) : (
                staffList.map((staff) => (
                  <TableRow key={staff.id}>
                    <TableCell className="font-medium">{staff.name}</TableCell>
                    <TableCell>{staff.gender}</TableCell>
                    <TableCell>{staff.title}</TableCell>
                    <TableCell>{staff.notes}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(staff)}>編輯</Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(staff.id!)}>刪除</Button>
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
