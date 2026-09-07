'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { StoreSettings } from '@/generated/prisma/client';
import { updateStoreSettings } from '@/lib/settings/actions';
import {
  storeSettingsSchema,
  StoreSettingsFormValues,
} from '@/lib/settings/validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface GeneralSettingsFormProps {
  initialData: StoreSettings;
}

export function GeneralSettingsForm({ initialData }: GeneralSettingsFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<StoreSettingsFormValues>({
    resolver: zodResolver(storeSettingsSchema),
    defaultValues: {
      currencyCode: initialData.currencyCode,
      currencySymbol: initialData.currencySymbol,
      taxRegistration: initialData.taxRegistration || '',
      receiptFooter: initialData.receiptFooter || '',
    },
  });

  async function onSubmit(data: StoreSettingsFormValues) {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          formData.append(key, value.toString());
        }
      });
      await updateStoreSettings(formData);
      toast.success('Settings updated successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update settings');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6 rounded-lg border p-6 shadow-sm"
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="currencyCode">Currency Code (e.g., USD, EUR)</Label>
          <Input id="currencyCode" {...register('currencyCode')} />
          {errors.currencyCode && (
            <p className="text-sm text-red-500">
              {errors.currencyCode.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="currencySymbol">Currency Symbol (e.g., $, €)</Label>
          <Input id="currencySymbol" {...register('currencySymbol')} />
          {errors.currencySymbol && (
            <p className="text-sm text-red-500">
              {errors.currencySymbol.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="taxRegistration">Tax Registration Number</Label>
        <Input
          id="taxRegistration"
          {...register('taxRegistration')}
          placeholder="Optional"
        />
        {errors.taxRegistration && (
          <p className="text-sm text-red-500">
            {errors.taxRegistration.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="receiptFooter">Receipt Footer Message</Label>
        <Textarea
          id="receiptFooter"
          {...register('receiptFooter')}
          placeholder="Thank you for your business!"
          rows={3}
        />
        {errors.receiptFooter && (
          <p className="text-sm text-red-500">{errors.receiptFooter.message}</p>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </form>
  );
}
