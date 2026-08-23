'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Device } from '@/generated/prisma/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  createDevice,
  updateDevice,
  deleteDevice,
} from '@/lib/repairs/actions';
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react';

export function DeviceListClient({
  customerId,
  initialDevices,
}: {
  customerId: string;
  initialDevices: Device[];
}) {
  const router = useRouter();
  const [devices, setDevices] = useState(initialDevices);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);

  const [formData, setFormData] = useState({
    make: '',
    model: '',
    serialNumber: '',
    notes: '',
  });

  const resetForm = () => {
    setFormData({ make: '', model: '', serialNumber: '', notes: '' });
    setEditingDevice(null);
  };

  const handleOpen = (device?: Device) => {
    if (device) {
      setEditingDevice(device);
      setFormData({
        make: device.make,
        model: device.model,
        serialNumber: device.serialNumber || '',
        notes: device.notes || '',
      });
    } else {
      resetForm();
    }
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const data = new FormData();
      data.set('customerId', customerId);
      data.set('make', formData.make);
      data.set('model', formData.model);
      if (formData.serialNumber)
        data.set('serialNumber', formData.serialNumber);
      if (formData.notes) data.set('notes', formData.notes);

      if (editingDevice) {
        data.set('deviceId', editingDevice.id);
        const updated = await updateDevice(data);
        setDevices(devices.map((d) => (d.id === updated.id ? updated : d)));
      } else {
        const created = await createDevice(data);
        setDevices([created, ...devices]);
      }

      setIsOpen(false);
      resetForm();
      router.refresh();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (deviceId: string) => {
    if (!confirm('Are you sure you want to delete this device?')) return;
    try {
      await deleteDevice(deviceId);
      setDevices(devices.filter((d) => d.id !== deviceId));
      router.refresh();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Could not delete device');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Registered Devices</h3>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger>
            <Button onClick={() => handleOpen()} className="gap-2">
              <Plus className="h-4 w-4" />
              Register Device
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingDevice ? 'Edit Device' : 'Register New Device'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="make">Make</Label>
                <Input
                  id="make"
                  required
                  value={formData.make}
                  onChange={(e) =>
                    setFormData({ ...formData, make: e.target.value })
                  }
                  placeholder="e.g. Apple, Samsung, Dell"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  required
                  value={formData.model}
                  onChange={(e) =>
                    setFormData({ ...formData, model: e.target.value })
                  }
                  placeholder="e.g. iPhone 13 Pro, Galaxy S21"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="serialNumber">Serial Number (Optional)</Label>
                <Input
                  id="serialNumber"
                  value={formData.serialNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, serialNumber: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                />
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingDevice ? 'Save Changes' : 'Register Device'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Make</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Serial Number</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground py-8 text-center"
                >
                  No devices registered for this customer.
                </TableCell>
              </TableRow>
            ) : (
              devices.map((device) => (
                <TableRow key={device.id}>
                  <TableCell className="font-medium">{device.make}</TableCell>
                  <TableCell>{device.model}</TableCell>
                  <TableCell>{device.serialNumber || 'N/A'}</TableCell>
                  <TableCell>{device.notes || 'N/A'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpen(device)}
                        title="Edit Device"
                      >
                        <Pencil className="text-muted-foreground h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(device.id)}
                        title="Delete Device"
                      >
                        <Trash2 className="text-destructive h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
