import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { CalendarModal } from '@/components/CalendarModal';
import { format } from 'date-fns';

export function Navbar() {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const today = new Date();

  return (
    <>
      <header className="h-16 bg-background flex items-center px-6 justify-between border-b border-border/40">
        <div className="font-bold text-xl lg:hidden text-primary">Material Hub</div>
        <div className="hidden lg:block"></div>
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            className="relative h-10 w-10 p-0 rounded-lg flex flex-col items-center justify-center overflow-hidden border-primary/30 hover:border-primary shadow-sm" 
            onClick={() => setIsCalendarOpen(true)} 
            title="行事曆設定"
          >
            <div className="bg-destructive w-full h-3.5 text-[9px] font-bold text-white flex items-center justify-center leading-none">
              {format(today, 'MMM')}
            </div>
            <div className="flex-1 flex items-center justify-center text-base font-bold text-foreground leading-none">
              {format(today, 'd')}
            </div>
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full">
            <User className="w-5 h-5 text-muted-foreground" />
          </Button>
        </div>
      </header>
      <CalendarModal isOpen={isCalendarOpen} onClose={() => setIsCalendarOpen(false)} />
    </>
  );
}
