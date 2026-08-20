import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Key,
  Building,
  Package,
  Boxes,
  UsersRound,
  Truck,
  Wrench,
  Receipt,
  FileText,
  LineChart,
  Settings,
} from 'lucide-react';

export interface NavigationItem {
  label: string;
  href: string;
  icon: React.ElementType;
  permission: string;
}

export const NAVIGATION_CONFIG: NavigationItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    permission: 'dashboard:read',
  },
  {
    label: 'Users',
    href: '/users',
    icon: Users,
    permission: 'users:read',
  },
  {
    label: 'Roles',
    href: '/roles',
    icon: ShieldCheck,
    permission: 'roles:read',
  },
  {
    label: 'Permissions',
    href: '/permissions',
    icon: Key,
    permission: 'permissions:read',
  },
  {
    label: 'Branches',
    href: '/branches',
    icon: Building,
    permission: 'branches:read',
  },
  {
    label: 'Products',
    href: '/products',
    icon: Package,
    permission: 'products:read',
  },
  {
    label: 'Inventory',
    href: '/inventory',
    icon: Boxes,
    permission: 'inventory:read',
  },
  {
    label: 'Customers',
    href: '/customers',
    icon: UsersRound,
    permission: 'customers:read',
  },
  {
    label: 'Suppliers',
    href: '/suppliers',
    icon: Truck,
    permission: 'suppliers:read',
  },
  {
    label: 'Repairs',
    href: '/repairs',
    icon: Wrench,
    permission: 'repairs:read',
  },
  {
    label: 'Sales',
    href: '/sales',
    icon: Receipt,
    permission: 'sales:read',
  },
  {
    label: 'Quotations',
    href: '/quotations',
    icon: FileText,
    permission: 'quotations:read',
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: LineChart,
    permission: 'reports:read',
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    permission: 'settings:read',
  },
];

export function getAuthorizedNavigation(
  userPermissions: string[]
): NavigationItem[] {
  return NAVIGATION_CONFIG.filter((item) =>
    userPermissions.includes(item.permission)
  );
}
