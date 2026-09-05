'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createSupplier, updateSupplier } from '@/lib/suppliers/actions';
import { supplierSchema, SupplierFormValues } from '@/lib/suppliers/validation';

export function SupplierForm({
  initialData,
  supplierId,
}: {
  initialData?: SupplierFormValues;
  supplierId?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: initialData || {
      name: '',
      contactName: '',
      email: '',
      phone: '',
    },
  });

  const onSubmit = async (data: SupplierFormValues) => {
    setIsSubmitting(true);
    setError(null);

    try {
      let result;
      if (supplierId) {
        result = await updateSupplier(supplierId, data);
      } else {
        result = await createSupplier(data);
      }

      if (result.success) {
        router.push(supplierId ? `/suppliers/${supplierId}` : '/suppliers');
        router.refresh();
      } else {
        setError(result.error || 'An unexpected error occurred');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || 'Failed to save supplier');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="bg-destructive/15 text-destructive rounded-md p-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Supplier Name *</Label>
          <Input id="name" {...register('name')} disabled={isSubmitting} />
          {errors.name && (
            <p className="text-destructive text-sm">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="contactName">Contact Name</Label>
          <Input
            id="contactName"
            {...register('contactName')}
            disabled={isSubmitting}
          />
          {errors.contactName && (
            <p className="text-destructive text-sm">
              {errors.contactName.message}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" {...register('phone')} disabled={isSubmitting} />
          {errors.phone && (
            <p className="text-destructive text-sm">{errors.phone.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            {...register('email')}
            disabled={isSubmitting}
          />
          {errors.email && (
            <p className="text-destructive text-sm">{errors.email.message}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end space-x-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? 'Saving...'
            : supplierId
              ? 'Update Supplier'
              : 'Create Supplier'}
        </Button>
      </div>
    </form>
  );
}
