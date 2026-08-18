import { parseISO } from 'date-fns';

export interface HolidaySetting {
  id: string; // 'YYYY-MM-DD'
  date: string;
  type: 'holiday' | 'workday';
  description: string;
}

export function calculateWorkingDays(startStr: string, endStr: string | null | undefined, holidays: HolidaySetting[]): number {
  if (!startStr) return 0;
  
  const start = parseISO(startStr);
  const end = endStr ? parseISO(endStr) : new Date();
  
  if (end < start) return 0;

  let totalDays = 0;
  const holidayMap = new Map<string, HolidaySetting>();
  holidays.forEach(h => holidayMap.set(h.date, h));

  const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  let diffDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) return 0;

  for (let i = 1; i <= diffDays; i++) {
    const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    let isWorkday = !isWeekend;

    const custom = holidayMap.get(dateStr);
    if (custom) {
      if (custom.type === 'holiday') isWorkday = false;
      if (custom.type === 'workday') isWorkday = true;
    }

    if (isWorkday) {
      totalDays++;
    }
  }

  return totalDays;
}
