import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getCollection, updateDocument, deleteDocument, setDocumentWithId } from '@/lib/firebase/api';
import type { HolidaySetting } from '@/utils/dateUtils';
import { getTaiwanDateInfo } from '@/utils/taiwanFestivals';
import { Calendar } from 'lucide-react';

export function CalendarModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [holidays, setHolidays] = useState<HolidaySetting[]>([]);
  const [loading, setLoading] = useState(false);

  const [editDate, setEditDate] = useState<string | null>(null);
  const [editType, setEditType] = useState<'holiday' | 'workday'>('holiday');
  const [editDesc, setEditDesc] = useState('');

  const loadHolidays = async () => {
    setLoading(true);
    try {
      const hols = await getCollection('holidays') as HolidaySetting[];
      setHolidays(hols);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadHolidays();
      setEditDate(null);
    }
  }, [isOpen]);

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const handleYearChange = (val: string) => setCurrentDate(new Date(parseInt(val), currentDate.getMonth(), 1));
  const handleMonthChange = (val: string) => setCurrentDate(new Date(currentDate.getFullYear(), parseInt(val) - 1, 1));

  const saveSetting = async () => {
    if (!editDate || !editDesc.trim()) return;
    try {
      const existing = holidays.find(h => h.date === editDate);
      if (existing) {
        await updateDocument('holidays', existing.id, {
          type: editType,
          description: editDesc.trim()
        });
      } else {
        await setDocumentWithId('holidays', editDate, {
          date: editDate,
          type: editType,
          description: editDesc.trim()
        });
      }
      await loadHolidays();
      setEditDate(null);
    } catch (e) {
      console.error(e);
    }
  };

  const deleteSetting = async () => {
    if (!editDate) return;
    try {
      const existing = holidays.find(h => h.date === editDate);
      if (existing) {
        await deleteDocument('holidays', existing.id);
        await loadHolidays();
      }
      setEditDate(null);
    } catch (e) {
      console.error(e);
    }
  };

  const { calendarDays } = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days: any[] = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    
    const holidayMap = new Map(holidays.map(h => [h.date, h]));
    const todayStr = new Date().toISOString().split('T')[0];

    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const custom = holidayMap.get(dateStr);
      
      const taiwanInfo = getTaiwanDateInfo(d);
      
      days.push({
        date: i,
        dateStr,
        isWeekend,
        isToday: dateStr === todayStr,
        custom,
        festivals: taiwanInfo.festivals
      });
    }
    return { calendarDays: days };
  }, [currentDate, holidays]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <DialogTitle>行事曆設定</DialogTitle>
          </div>
          <DialogDescription>
            設定自訂的例假日或補班日，系統計算「管制天數」時將自動跳過休假日。
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex justify-between items-center my-4">
          <Button variant="outline" onClick={handlePrevMonth}>◀ 上個月</Button>
          <div className="flex items-center gap-2">
            <Select value={currentDate.getFullYear().toString()} onValueChange={handleYearChange}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({length: 10}, (_, i) => currentDate.getFullYear() - 5 + i).map(y => (
                  <SelectItem key={y} value={y.toString()}>{y} 年</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={(currentDate.getMonth() + 1).toString()} onValueChange={handleMonthChange}>
              <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                  <SelectItem key={m} value={m.toString()}>{m} 月</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={handleNextMonth}>下個月 ▶</Button>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {['日', '一', '二', '三', '四', '五', '六'].map(d => (
            <div key={d} className="text-center font-bold p-2 bg-primary text-primary-foreground rounded-md">
              星期{d}
            </div>
          ))}
          
          {loading ? (
            <div className="col-span-7 text-center p-10">載入中...</div>
          ) : (
            calendarDays.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} className="bg-muted/50 rounded-md border border-dashed border-muted-foreground/30 min-h-[100px]" />;
              
              let bgColor = day.isWeekend ? 'bg-muted/30' : 'bg-background';
              let borderColor = day.isToday ? 'border-amber-500 border-2 shadow-sm ring-1 ring-amber-500' : 'border-border border';
              
              if (day.custom?.type === 'holiday') bgColor = 'bg-red-50';
              if (day.custom?.type === 'workday') bgColor = 'bg-green-50';
              
              if (day.isToday) bgColor = 'bg-amber-50/50';

              return (
                <div 
                  key={day.dateStr}
                  onClick={() => {
                    setEditDate(day.dateStr);
                    setEditType(day.custom?.type || 'holiday');
                    setEditDesc(day.custom?.description || '');
                  }}
                  className={`${bgColor} ${borderColor} rounded-md p-2 min-h-[100px] cursor-pointer hover:shadow-md transition-shadow relative flex flex-col`}
                >
                  <div className="flex justify-between items-start">
                    <span className={`font-bold ${day.isWeekend || day.custom?.type === 'holiday' ? 'text-destructive' : ''} ${day.isToday ? 'bg-amber-500 text-white px-2.5 py-0.5 rounded-full text-sm shadow-sm' : ''}`}>
                      {day.date}
                    </span>
                    {day.isToday && (
                      <span className="text-xs font-bold text-amber-600 animate-pulse">今日</span>
                    )}
                  </div>
                  
                  <div className="mt-2 flex flex-col gap-1 flex-1">
                    {day.festivals.map((f: string, i: number) => (
                      <span key={i} className="text-[10px] text-blue-600 bg-blue-50 px-1 py-0.5 rounded w-fit">
                        {f}
                      </span>
                    ))}
                    {day.custom && (
                      <span className={`text-[10px] px-1 py-0.5 rounded w-fit mt-auto ${day.custom.type === 'holiday' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {day.custom.description}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {editDate && (
          <div className="mt-6 p-4 border rounded-md bg-muted/30">
            <h3 className="font-bold mb-4">設定 {editDate}</h3>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Label>類型</Label>
                <Select value={editType} onValueChange={(val: any) => setEditType(val)}>
                  <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="holiday">休假日</SelectItem>
                    <SelectItem value="workday">補班日</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 flex items-center gap-2">
                <Label>說明</Label>
                <Input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="例如：國定假日、彈性放假..." />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDate(null)}>取消</Button>
              {holidays.find(h => h.date === editDate) && (
                <Button variant="destructive" onClick={deleteSetting}>刪除設定</Button>
              )}
              <Button onClick={saveSetting}>儲存設定</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
