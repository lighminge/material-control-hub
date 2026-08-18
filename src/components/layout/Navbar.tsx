import { User, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { CalendarModal } from '@/components/CalendarModal';

export function Navbar() {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  return (
    <>
      <header className="h-16 bg-background flex items-center px-6 justify-between border-b border-border/40">
        <div className="font-bold text-xl lg:hidden text-primary">Material Hub</div>
        <div className="hidden lg:block"></div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setIsCalendarOpen(true)} title="行事曆設定">
            <Calendar className="w-5 h-5 text-muted-foreground" />
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
