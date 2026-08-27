'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export function ReportFilters({
  showBranchSelector,
}: {
  showBranchSelector: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [from, setFrom] = useState(searchParams.get('from') || '');
  const [to, setTo] = useState(searchParams.get('to') || '');
  const [branchId, setBranchId] = useState(searchParams.get('branchId') || '');

  const applyFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());

    if (from) params.set('from', from);
    else params.delete('from');

    if (to) params.set('to', to);
    else params.delete('to');

    if (showBranchSelector && branchId) params.set('branchId', branchId);
    else params.delete('branchId');

    router.push(`?${params.toString()}`);
  }, [from, to, branchId, showBranchSelector, router, searchParams]);

  const clearFilters = () => {
    setFrom('');
    setTo('');
    setBranchId('');
    router.push('?');
  };

  return (
    <div className="bg-muted/20 mb-6 flex flex-col items-end gap-4 rounded-md border p-4 md:flex-row">
      <div className="flex flex-col gap-2">
        <Label htmlFor="from">From Date</Label>
        <Input
          type="date"
          id="from"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="to">To Date</Label>
        <Input
          type="date"
          id="to"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>

      {showBranchSelector && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="branchId">Branch ID (Admin)</Label>
          <Input
            type="text"
            id="branchId"
            placeholder="Global or branchId"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          />
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={applyFilters}>Apply</Button>
        <Button variant="outline" onClick={clearFilters}>
          Clear
        </Button>
      </div>
    </div>
  );
}
