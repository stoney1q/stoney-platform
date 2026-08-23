import { getRepairQueue, RepairQueueDTO } from '@/lib/dashboard/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wrench, UserMinus } from 'lucide-react';
import { AuthError } from '@/lib/auth/guard';

export async function RepairQueueWidget({ userId }: { userId: string }) {
  let assignedQueue: RepairQueueDTO[] | null = null;
  let unassignedQueue: RepairQueueDTO[] | null = null;
  let authError = false;

  try {
    const [assigned, unassigned] = await Promise.all([
      getRepairQueue(userId),
      getRepairQueue(undefined), // Unassigned
    ]);
    assignedQueue = assigned;
    unassignedQueue = unassigned;
  } catch (error) {
    if (error instanceof AuthError && error.code === 'FORBIDDEN') {
      authError = true;
    }
  }

  if (authError) {
    return null;
  }

  if (!assignedQueue || !unassignedQueue) {
    return (
      <Card className="col-span-full border-red-200 bg-red-50">
        <CardContent className="p-4 text-sm text-red-600">
          Failed to load repair queue.
        </CardContent>
      </Card>
    );
  }

  const assignedCount = assignedQueue.reduce(
    (acc, curr) => acc + curr.count,
    0
  );
  const unassignedCount = unassignedQueue.reduce(
    (acc, curr) => acc + curr.count,
    0
  );

  return (
    <div className="col-span-full grid gap-4 md:grid-cols-2 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            My Assigned Repairs
          </CardTitle>
          <Wrench className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{assignedCount}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {assignedQueue.map((item) => (
              <span
                key={item.status}
                className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-700/10 ring-inset"
              >
                {item.status.replace('_', ' ')}: {item.count}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Unassigned Repairs
          </CardTitle>
          <UserMinus className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{unassignedCount}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {unassignedQueue.map((item) => (
              <span
                key={item.status}
                className="inline-flex items-center rounded-md bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 ring-1 ring-orange-700/10 ring-inset"
              >
                {item.status.replace('_', ' ')}: {item.count}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
