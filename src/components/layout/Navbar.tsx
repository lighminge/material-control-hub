import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Navbar() {
  return (
    <header className="h-16 bg-background flex items-center px-6 justify-between">
      <div className="font-bold text-xl lg:hidden text-primary">Material Hub</div>
      <div className="hidden lg:block"></div>
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full">
          <User className="w-5 h-5 text-muted-foreground" />
        </Button>
      </div>
    </header>
  );
}
