import { requireAuth } from '@/lib/auth/guard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, Building2, Activity } from 'lucide-react';

export default async function DashboardPage() {
  const user = await requireAuth();

  return (
    <div className="flex flex-1 flex-col gap-4 lg:gap-6">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Dashboard</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Welcome Back</CardTitle>
            <Activity className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {user.firstName} {user.lastName}
            </div>
            <p className="text-muted-foreground text-xs">{user.email}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Branch</CardTitle>
            <Building2 className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user.branch.name}</div>
            <p className="text-muted-foreground text-xs tracking-wider uppercase">
              {user.branch.code}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Access Role</CardTitle>
            <ShieldCheck className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user.role.name}</div>
            <p className="text-muted-foreground text-xs">
              {user.permissions.length} permissions granted
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-8 shadow-sm">
        <div className="flex flex-col items-center gap-1 text-center">
          <h3 className="text-2xl font-bold tracking-tight">Dashboard Data</h3>
          <p className="text-muted-foreground max-w-[500px] text-sm">
            Platform modules (Inventory, Sales, Repairs) will be built in future
            loops. Business metrics will appear here once transactional data
            exists.
          </p>
        </div>
      </div>
    </div>
  );
}
