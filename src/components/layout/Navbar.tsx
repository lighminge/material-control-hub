import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Navbar() {
  return (
    <header className="h-14 border-b bg-card flex items-center px-6 justify-between">
      <div className="font-semibold lg:hidden text-primary">Material Control Hub</div>
      <div className="hidden lg:block"></div>
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full">
          <User className="w-5 h-5 text-muted-foreground" />
        </Button>
      </div>
    </header>
  );
}
