import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { CalendarModal } from '@/components/CalendarModal';
import { getTaiwanDateInfo } from '@/utils/taiwanFestivals';
import type { TaiwanDateInfo } from '@/utils/taiwanFestivals';

export function Navbar() {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [dateInfo, setDateInfo] = useState<TaiwanDateInfo | null>(null);

  useEffect(() => {
    setDateInfo(getTaiwanDateInfo(new Date()));
  }, []);

  return (
    <>
      <header className="min-h-16 py-2 bg-background flex items-center px-6 justify-between border-b border-border/40">
        <div className="font-bold text-xl lg:hidden text-primary">Material Hub</div>
        <div className="hidden lg:block"></div>
        <div className="flex items-center gap-4">
          {dateInfo && (
            <div 
              onClick={() => setIsCalendarOpen(true)}
              className="flex flex-col items-center bg-card border border-border shadow-sm rounded-md w-[110px] overflow-hidden relative cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all group shrink-0"
              title="行事曆設定"
            >
              <div className="bg-destructive text-white w-full text-center py-1 font-bold text-xs border-b border-border">
                {dateInfo.dateStr.split('-')[0]} 年 {dateInfo.dateStr.split('-')[1]} 月
              </div>
              
              <div className="text-4xl font-black text-foreground mt-1 mb-0 leading-none group-hover:text-primary transition-colors tracking-tighter">
                {dateInfo.dateStr.split('-')[2]}
              </div>
              
              <div className="text-xs font-bold text-muted-foreground mb-1 mt-0.5">
                {dateInfo.weekStr}
              </div>

              {dateInfo.festivals.length > 0 && (
                <div className="w-full bg-amber-50/80 text-amber-700 font-bold text-[10px] text-center py-0.5 border-t border-border/50 truncate px-1">
                  {dateInfo.festivals.join('、')}
                </div>
              )}
            </div>
          )}
          <Button variant="ghost" size="icon" className="rounded-full shrink-0">
            <User className="w-5 h-5 text-muted-foreground" />
          </Button>
        </div>
      </header>
      <CalendarModal isOpen={isCalendarOpen} onClose={() => setIsCalendarOpen(false)} />
    </>
  );
}
