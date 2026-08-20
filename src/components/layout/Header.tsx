import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, Menu } from 'lucide-react';

import { cn } from '@/lib/utils';
import { AuthenticatedUser } from '@/lib/auth/types';
import { NavigationItem } from '@/config/navigation';

import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { buttonVariants } from '@/components/ui/button';
import { UserMenu } from './UserMenu';

interface HeaderProps {
  user: AuthenticatedUser;
  items: NavigationItem[];
}

export function Header({ user, items }: HeaderProps) {
  const pathname = usePathname();

  return (
    <header className="bg-muted/40 flex h-14 items-center gap-4 border-b px-4 lg:h-[60px] lg:px-6">
      <Sheet>
        <SheetTrigger
          className={buttonVariants({
            variant: 'outline',
            size: 'icon',
            className: 'shrink-0 sm:hidden',
          })}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle navigation menu</span>
        </SheetTrigger>
        <SheetContent side="left" className="flex flex-col">
          <nav className="mt-4 grid gap-2 text-lg font-medium">
            <Link
              href="/"
              className="mb-4 flex items-center gap-2 text-lg font-semibold"
            >
              <Building2 className="h-6 w-6" />
              <span className="truncate">Stoney Platform</span>
            </Link>
            {items.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'hover:text-foreground mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2',
                    isActive
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto border-t pt-4">
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-foreground truncate font-medium">
                {user.branch.name}
              </span>
              <span className="text-muted-foreground text-xs tracking-wider uppercase">
                Branch {user.branch.code}
              </span>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <div className="w-full flex-1">
        {/* Placeholder for Breadcrumbs or global search */}
      </div>

      <UserMenu user={user} />
    </header>
  );
}
