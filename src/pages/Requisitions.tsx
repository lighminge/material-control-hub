import { useState, useEffect } from 'react';
import { getCollection, addDocument, updateDocument, deleteDocument } from '@/lib/firebase/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus } from 'lucide-react';
import { format } from 'date-fns';
import type { Material } from './Materials';

export type RequisitionItem = {
  materialId: string;
  materialName: string;
  requiredQuantity: number;
  currentStock: number;
  missingQuantity: number;
};

export type Requisition = {
  id?: string;
  staffId: string;
  staffName: string;
  itemCount: number;
  items: RequisitionItem[];
  status: '已完成' | '缺料管制中';
  createdAt?: any;
};

export default function RequisitionsPage() {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Requisition>({
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
      setRequisitions(reqs as Requisition[]);
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
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems });
  };

  const handleItemChange = (index: number, field: keyof RequisitionItem, value: any) => {
    const newItems = [...formData.items];
    const item = { ...newItems[index] };
    
    if (field === 'materialId') {
      const mat = materials.find(m => m.id === value);
      item.materialId = value;
      item.materialName = mat?.name || '';
      item.currentStock = mat?.stock || 0;
    } else if (field === 'requiredQuantity') {
      item.requiredQuantity = parseInt(value) || 0;
    }

    item.missingQuantity = Math.max(0, item.requiredQuantity - item.currentStock);
    newItems[index] = item;

    // Check overall status
    const hasMissing = newItems.some(i => i.missingQuantity > 0);
    
    setFormData({ 
      ...formData, 
      items: newItems, 
      itemCount: newItems.length,
      status: hasMissing ? '缺料管制中' : '已完成'
    });
  };

  const handleSave = async () => {
    if (!formData.staffId) {
      alert("請選擇備料人員");
      return;
    }
    
    try {
      let reqId = editingId;
      if (editingId) {
        await updateDocument('requisitions', editingId, formData);
      } else {
        reqId = await addDocument('requisitions', formData);
      }
      
      // If status is missing, we need to create a control document if not editing,
      // but to keep it simple, we can have a button to "轉入物料管制" or create it automatically.
      // We will handle automatic creation of control if '缺料管制中' and it's new.
      if (!editingId && formData.status === '缺料管制中') {
        const controlItems = formData.items
          .filter(i => i.missingQuantity > 0)
          .map(i => ({
            materialId: i.materialId,
            materialName: i.materialName,
            missingQuantity: i.missingQuantity,
            restockDate: '',
            notes: ''
          }));
        
        await addDocument('controls', {
          requisitionId: reqId,
          startDate: format(new Date(), 'yyyy-MM-dd'),
          endDate: null,
          items: controlItems,
          status: '處理中',
          notes: '由領料單自動產生'
        });
      }

      setIsOpen(false);
      loadData();
    } catch (error) {
      console.error("Error saving requisition:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('確定要刪除此領料單嗎？')) {
      await deleteDocument('requisitions', id);
      loadData();
    }
  };

  const openNewForm = () => {
    setFormData({ staffId: '', staffName: '', itemCount: 0, items: [], status: '已完成' });
    setEditingId(null);
    setIsOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-primary">領料單管理</h1>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNewForm}>新增領料單</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{editingId ? '編輯領料單' : '新增領料單'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
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

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-lg">物料項目</Label>
                  <Button variant="outline" size="sm" onClick={handleAddItem}>
                    <Plus className="w-4 h-4 mr-2" /> 新增項目
                  </Button>
                </div>
                
                {formData.items.length === 0 && (
                  <div className="text-center text-muted-foreground p-4 border rounded-md">
                    尚未加入任何物料
                  </div>
                )}

                {formData.items.map((item, index) => (
                  <div key={index} className="flex items-center gap-4 border p-4 rounded-md bg-muted/50">
                    <div className="flex-1 space-y-2">
                      <Label>選擇物料</Label>
                      <Select value={item.materialId} onValueChange={(val) => handleItemChange(index, 'materialId', val)}>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇物料" />
                        </SelectTrigger>
                        <SelectContent>
                          {materials.map(mat => (
                            <SelectItem key={mat.id} value={mat.id!}>{mat.name} (庫存: {mat.stock})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-32 space-y-2">
                      <Label>需領數量</Label>
                      <Input 
                        type="number" 
                        value={item.requiredQuantity} 
                        onChange={(e) => handleItemChange(index, 'requiredQuantity', e.target.value)} 
                        min="1"
                      />
                    </div>
                    <div className="w-24 space-y-2">
                      <Label>庫存量</Label>
                      <div className="h-10 flex items-center px-3 border rounded-md bg-background text-muted-foreground">
                        {item.currentStock}
                      </div>
                    </div>
                    <div className="w-24 space-y-2">
                      <Label>缺料數量</Label>
                      <div className={`h-10 flex items-center px-3 border rounded-md font-bold ${item.missingQuantity > 0 ? 'text-destructive bg-destructive/10' : 'text-green-600 bg-green-50'}`}>
                        {item.missingQuantity}
                      </div>
                    </div>
                    <div className="pt-6">
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(index)}>
                        <Trash2 className="w-5 h-5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex justify-between items-center border-t">
                <div className="font-medium">
                  單據狀態: <Badge variant={formData.status === '已完成' ? 'default' : 'destructive'} className="ml-2">{formData.status}</Badge>
                </div>
                <Button onClick={handleSave}>儲存單據</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>單號 ID</TableHead>
                <TableHead>備料人員</TableHead>
                <TableHead>項目數</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">載入中...</TableCell>
                </TableRow>
              ) : requisitions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">尚無領料單資料</TableCell>
                </TableRow>
              ) : (
                requisitions.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">{req.id?.slice(0, 8)}...</TableCell>
                    <TableCell>{req.staffName}</TableCell>
                    <TableCell>{req.itemCount}</TableCell>
                    <TableCell>
                      <Badge variant={req.status === '已完成' ? 'default' : 'destructive'}>
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => {
                        setFormData(req);
                        setEditingId(req.id || null);
                        setIsOpen(true);
                      }}>編輯</Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(req.id!)}>刪除</Button>
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
