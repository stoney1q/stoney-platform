import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NavigationItem } from '@/config/navigation';
import { AuthenticatedUser } from '@/lib/auth/types';
import { Building2 } from 'lucide-react';

interface SidebarProps {
  items: NavigationItem[];
  user: AuthenticatedUser;
}

export function Sidebar({ items, user }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="bg-background fixed inset-y-0 left-0 z-10 hidden w-64 flex-col border-r sm:flex">
      <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Building2 className="h-6 w-6" />
          <span className="truncate">Stoney Platform</span>
        </Link>
      </div>

      <div className="flex-1 overflow-auto py-2">
        <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'hover:text-primary flex items-center gap-3 rounded-lg px-3 py-2 transition-all',
                  isActive ? 'bg-muted text-primary' : 'text-muted-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto border-t p-4">
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-foreground truncate font-medium">
            {user.branch.name}
          </span>
          <span className="text-muted-foreground text-xs tracking-wider uppercase">
            Branch {user.branch.code}
          </span>
        </div>
      </div>
    </aside>
  );
}
