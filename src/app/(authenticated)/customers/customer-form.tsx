'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createCustomer,
  updateCustomer,
  CustomerDuplicateWarning,
} from '@/lib/customers/actions';
import { customerSchema, CustomerFormValues } from '@/lib/customers/validation';

export function CustomerForm({
  initialData,
  customerId,
}: {
  initialData?: CustomerFormValues;
  customerId?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<CustomerDuplicateWarning | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: initialData || {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      alternatePhone: '',
      address: '',
      isActive: true,
    },
  });

  const onSubmit = async (data: CustomerFormValues, force: boolean = false) => {
    setIsSubmitting(true);
    setError(null);
    if (force) {
      setWarning(null); // Clear warning if they forced
    }

    try {
      let result:
        | Awaited<ReturnType<typeof createCustomer>>
        | Awaited<ReturnType<typeof updateCustomer>>;
      if (customerId) {
        result = await updateCustomer(customerId, data);
      } else {
        result = await createCustomer(data, force);
      }

      if (result.success) {
        router.push(customerId ? `/customers/${customerId}` : '/customers');
        router.refresh();
      } else if ('warning' in result && result.warning) {
        setWarning(result.warning);
        setIsSubmitting(false);
        return;
      } else {
        setError(result.error || 'An unexpected error occurred');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || 'Failed to save customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit((data) => onSubmit(data, false))}
      className="space-y-6"
    >
      {error && (
        <div className="bg-destructive/15 text-destructive rounded-md p-3 text-sm">
          {error}
        </div>
      )}

      {warning && (
        <div className="space-y-2 rounded-md bg-amber-100 p-4 text-sm text-amber-800">
          <p className="font-semibold">Potential Duplicate Detected:</p>
          <ul className="list-disc pl-5">
            {warning.duplicateMatches.map((m, i) => (
              <li key={i}>
                {m.name} ({m.email || 'no email'}, {m.phone || 'no phone'})
              </li>
            ))}
          </ul>
          <div className="pt-2">
            <Button
              type="button"
              variant="default"
              className="bg-amber-600 text-white hover:bg-amber-700"
              onClick={handleSubmit((data) => onSubmit(data, true))}
              disabled={isSubmitting}
            >
              Proceed Anyway (Force Create)
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name *</Label>
          <Input
            id="firstName"
            {...register('firstName')}
            disabled={isSubmitting}
          />
          {errors.firstName && (
            <p className="text-destructive text-sm">
              {errors.firstName.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name *</Label>
          <Input
            id="lastName"
            {...register('lastName')}
            disabled={isSubmitting}
          />
          {errors.lastName && (
            <p className="text-destructive text-sm">
              {errors.lastName.message}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone (Required if no email)</Label>
          <Input id="phone" {...register('phone')} disabled={isSubmitting} />
          {errors.phone && (
            <p className="text-destructive text-sm">{errors.phone.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email (Required if no phone)</Label>
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

      <div className="space-y-2">
        <Label htmlFor="alternatePhone">Alternate Phone</Label>
        <Input
          id="alternatePhone"
          {...register('alternatePhone')}
          disabled={isSubmitting}
        />
        {errors.alternatePhone && (
          <p className="text-destructive text-sm">
            {errors.alternatePhone.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Input id="address" {...register('address')} disabled={isSubmitting} />
        {errors.address && (
          <p className="text-destructive text-sm">{errors.address.message}</p>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="isActive"
          {...register('isActive')}
          disabled={isSubmitting}
          className="h-4 w-4 rounded border-gray-300"
        />
        <Label htmlFor="isActive">Active Customer</Label>
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
            : customerId
              ? 'Update Customer'
              : 'Create Customer'}
        </Button>
      </div>
    </form>
  );
}
