'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

import {
  openShift,
  closeShift,
  addCashMovement,
  getActiveShift,
} from '@/lib/shifts/actions';
import type { SafeShiftDTO } from '@/lib/shifts/dtos';
import type { CashMovementType } from '@/generated/prisma/client';

export default function ShiftsPage() {
  const [activeShift, setActiveShift] = useState<SafeShiftDTO | null>(null);
  const [loading, setLoading] = useState(true);

  // Forms state
  const [openingBalance, setOpeningBalance] = useState('');
  const [closingBalance, setClosingBalance] = useState('');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');
  const [movementType, setMovementType] = useState<CashMovementType>('CASH_IN');

  const fetchShift = async () => {
    try {
      const shift = await getActiveShift();
      setActiveShift(shift);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchShift();
  }, []);

  const handleOpenShift = async () => {
    try {
      const fd = new FormData();
      fd.append('openingBalance', openingBalance);
      await openShift(fd);
      alert('Shift opened successfully');
      setOpeningBalance('');
      await fetchShift();
    } catch (e: unknown) {
      alert(`Error opening shift: ${(e as Error).message}`);
    }
  };

  const handleCloseShift = async () => {
    if (!activeShift) return;
    try {
      const fd = new FormData();
      fd.append('shiftId', activeShift.id);
      fd.append('closingBalance', closingBalance);
      await closeShift(fd);
      alert('Shift closed successfully');
      setClosingBalance('');
      await fetchShift();
    } catch (e: unknown) {
      alert(`Error closing shift: ${(e as Error).message}`);
    }
  };

  const handleCashMovement = async () => {
    if (!activeShift) return;
    try {
      const fd = new FormData();
      fd.append('shiftId', activeShift.id);
      fd.append('type', movementType);
      fd.append('amount', movementAmount);
      fd.append('reason', movementReason);
      await addCashMovement(fd);
      alert('Cash movement recorded');
      setMovementAmount('');
      setMovementReason('');
      await fetchShift();
    } catch (e: unknown) {
      alert(`Error adding cash movement: ${(e as Error).message}`);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Shift Management</h1>
        {activeShift ? (
          <Badge variant="default" className="text-sm">
            OPEN SHIFT
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-sm">
            NO ACTIVE SHIFT
          </Badge>
        )}
      </div>

      {!activeShift ? (
        <Card>
          <CardHeader>
            <CardTitle>Open a New Shift</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="openingBalance">Opening Float Balance ($)</Label>
              <Input
                type="number"
                id="openingBalance"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="e.g. 150.00"
              />
            </div>
            <Button onClick={handleOpenShift}>Open Shift</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-8 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Current Shift Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Opening Balance:</span>
                <span className="font-medium">
                  ${activeShift.openingBalance}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expected Balance:</span>
                <span className="font-medium text-blue-600">
                  ${activeShift.expectedBalance}
                </span>
              </div>

              <div className="mt-4 border-t pt-4">
                <Label htmlFor="closingBalance" className="mb-2 block">
                  Actual Physical Cash Count ($)
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    id="closingBalance"
                    value={closingBalance}
                    onChange={(e) => setClosingBalance(e.target.value)}
                    placeholder="e.g. 350.00"
                  />
                  <Button variant="destructive" onClick={handleCloseShift}>
                    Close Shift
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cash Movement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Button
                  variant={movementType === 'CASH_IN' ? 'default' : 'outline'}
                  onClick={() => setMovementType('CASH_IN')}
                >
                  Cash In
                </Button>
                <Button
                  variant={movementType === 'CASH_OUT' ? 'default' : 'outline'}
                  onClick={() => setMovementType('CASH_OUT')}
                >
                  Cash Out
                </Button>
              </div>
              <div className="grid gap-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  value={movementAmount}
                  onChange={(e) => setMovementAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <Label>Reason</Label>
                <Input
                  type="text"
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  placeholder="e.g. Change delivery, Payout"
                />
              </div>
              <Button onClick={handleCashMovement} className="w-full">
                Record {movementType === 'CASH_IN' ? 'Cash In' : 'Cash Out'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
