import { useState, useEffect } from 'react';
import { getCollection, updateDocument } from '@/lib/firebase/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { differenceInDays, parseISO } from 'date-fns';

export type ControlItem = {
  materialId: string;
  materialName: string;
  missingQuantity: number;
  restockDate: string;
  notes: string;
};

export type Control = {
  id?: string;
  requisitionId: string;
  startDate: string;
  endDate: string | null;
  items: ControlItem[];
  status: '處理中' | '已結案';
  notes: string;
};

export default function ControlsPage() {
  const [controls, setControls] = useState<Control[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<Control | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getCollection('controls') as Control[];
      setControls(data);
    } catch (error) {
      console.error("Error loading controls:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleItemChange = (index: number, field: keyof ControlItem, value: any) => {
    if (!formData) return;
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const handleSave = async () => {
    if (!formData || !formData.id) return;
    
    try {
      // Auto resolve status if all restockDates are set? Or just let user manage status manually.
      // If setting to resolved, set endDate.
      let toSave = { ...formData };
      if (toSave.status === '已結案' && !toSave.endDate) {
        toSave.endDate = new Date().toISOString().split('T')[0];
      } else if (toSave.status === '處理中') {
        toSave.endDate = null;
      }
      
      await updateDocument('controls', formData.id, toSave);
      setIsOpen(false);
      loadData();
    } catch (error) {
      console.error("Error saving control:", error);
    }
  };

  const calculateDays = (startDate: string, endDate: string | null) => {
    const start = parseISO(startDate);
    const end = endDate ? parseISO(endDate) : new Date();
    return Math.max(0, differenceInDays(end, start));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-primary">物料管制</h1>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>編輯物料管制單</DialogTitle>
          </DialogHeader>
          {formData && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>關聯領料單號</Label>
                  <div className="p-2 border rounded-md bg-muted/50">{formData.requisitionId.slice(0, 8)}...</div>
                </div>
                <div className="space-y-2">
                  <Label>狀態</Label>
                  <select 
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                  >
                    <option value="處理中">處理中</option>
                    <option value="已結案">已結案</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>管制開始日期</Label>
                  <div className="p-2 border rounded-md bg-muted/50">{formData.startDate}</div>
                </div>
                <div className="space-y-2">
                  <Label>整體備註</Label>
                  <Input 
                    value={formData.notes || ''} 
                    onChange={(e) => setFormData({...formData, notes: e.target.value})} 
                    placeholder="如: 廠商延遲交貨"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-lg">缺料項目清單</Label>
                {formData.items.map((item, index) => (
                  <Card key={index} className="bg-muted/30">
                    <CardContent className="p-4 grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-3">
                        <Label className="text-xs text-muted-foreground">物料名稱</Label>
                        <div className="font-medium">{item.materialName}</div>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs text-muted-foreground">缺少數量</Label>
                        <div className="font-bold text-destructive">{item.missingQuantity}</div>
                      </div>
                      <div className="col-span-3 space-y-1">
                        <Label className="text-xs">預計補完日期</Label>
                        <Input 
                          type="date" 
                          value={item.restockDate} 
                          onChange={(e) => handleItemChange(index, 'restockDate', e.target.value)}
                        />
                      </div>
                      <div className="col-span-4 space-y-1">
                        <Label className="text-xs">後續處理情況/備註</Label>
                        <Input 
                          value={item.notes} 
                          onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                          placeholder="進度說明..."
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="pt-4 flex justify-end border-t">
                <Button onClick={handleSave}>儲存更新</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>管制單號 ID</TableHead>
                <TableHead>關聯領料單</TableHead>
                <TableHead>開始日期</TableHead>
                <TableHead>管制天數</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">載入中...</TableCell>
                </TableRow>
              ) : controls.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">目前尚無管制單</TableCell>
                </TableRow>
              ) : (
                controls.map((control) => (
                  <TableRow key={control.id}>
                    <TableCell className="font-medium">{control.id?.slice(0, 8)}...</TableCell>
                    <TableCell className="text-muted-foreground">{control.requisitionId.slice(0, 8)}...</TableCell>
                    <TableCell>{control.startDate}</TableCell>
                    <TableCell>
                      <div className={`font-bold ${calculateDays(control.startDate, control.endDate) > 7 ? 'text-destructive' : ''}`}>
                        {calculateDays(control.startDate, control.endDate)} 天
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={control.status === '已結案' ? 'default' : 'secondary'} className={control.status === '處理中' ? 'bg-amber-500 hover:bg-amber-600' : ''}>
                        {control.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => {
                        setFormData(control);
                        setIsOpen(true);
                      }}>處理 / 檢視</Button>
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
