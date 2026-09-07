'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { createAudit } from '@/lib/inventory/audit-actions';

interface Branch {
  id: string;
  name: string;
}

export function CreateAuditForm({ branches }: { branches: Branch[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [branchId, setBranchId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!branchId) throw new Error('Please select a branch');
      const audit = await createAudit(branchId, name);
      router.push(`/inventory/audits/${audit.id}`);
    } catch (err: unknown) {
      setError((err as Error).message || 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-500">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="branchId">Branch</Label>
            <Select
              onValueChange={(val: string | null) => val && setBranchId(val)}
              value={branchId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select branch..." />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Audit Name (Optional)</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., September Cycle Count"
            />
          </div>

          <div className="flex space-x-2 pt-4">
            <Button type="submit" disabled={loading || !branchId}>
              {loading ? 'Creating...' : 'Start Audit'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
