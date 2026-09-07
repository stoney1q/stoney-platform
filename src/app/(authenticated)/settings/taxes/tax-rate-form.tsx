'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TaxRate } from '@/generated/prisma/client';
import {
  createTaxRate,
  updateTaxRate,
  deleteTaxRate,
} from '@/lib/settings/actions';
import { taxRateSchema, TaxRateFormValues } from '@/lib/settings/validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';

interface TaxRateFormProps {
  initialData?: TaxRate;
}

export function TaxRateForm({ initialData }: TaxRateFormProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!initialData;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<TaxRateFormValues>({
    resolver: zodResolver(taxRateSchema) as any,
    defaultValues: {
      name: initialData?.name || '',
      rate: initialData ? Number(initialData.rate) : 0,
      isActive: initialData?.isActive ?? true,
      isDefault: initialData?.isDefault ?? false,
    },
  });

  const isActive = watch('isActive');
  const isDefault = watch('isDefault');

  async function onSubmit(data: TaxRateFormValues) {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('name', data.name);
      formData.append('rate', data.rate.toString());
      formData.append('isActive', data.isActive.toString());
      formData.append('isDefault', data.isDefault.toString());

      if (isEditing) {
        await updateTaxRate(initialData.id, formData);
        toast.success('Tax rate updated successfully');
      } else {
        await createTaxRate(formData);
        toast.success('Tax rate created successfully');
      }
      setOpen(false);
      if (!isEditing) reset();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save tax rate');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (
      !initialData ||
      !confirm('Are you sure you want to delete this tax rate?')
    )
      return;

    setIsSubmitting(true);
    try {
      await deleteTaxRate(initialData.id);
      toast.success('Tax rate deleted');
      setOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete tax rate');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          isEditing ? (
            <Button variant="ghost" size="icon">
              <Pencil className="h-4 w-4" />
            </Button>
          ) : (
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Tax Rate
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Tax Rate' : 'Add Tax Rate'}
          </DialogTitle>
          <DialogDescription>
            Configure a tax rate to apply to products and services.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="e.g. Standard VAT 20%"
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="rate">Rate (Decimal between 0 and 1)</Label>
            <Input
              id="rate"
              type="number"
              step="0.0001"
              {...register('rate')}
              placeholder="e.g. 0.2000 for 20%"
            />
            {errors.rate && (
              <p className="text-sm text-red-500">{errors.rate.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Active</Label>
              <p className="text-sm text-gray-500">
                Enable this tax rate for new products.
              </p>
            </div>
            <Switch
              checked={isActive}
              onCheckedChange={(checked) => setValue('isActive', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Default</Label>
              <p className="text-sm text-gray-500">
                Make this the default tax rate for new products.
              </p>
            </div>
            <Switch
              checked={isDefault}
              onCheckedChange={(checked) => setValue('isDefault', checked)}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {isEditing && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="mr-auto"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
