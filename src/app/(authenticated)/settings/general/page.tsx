import { getStoreSettings } from '@/lib/settings/actions';
import { GeneralSettingsForm } from './general-settings-form';

export const dynamic = 'force-dynamic';

export default async function GeneralSettingsPage() {
  const settings = await getStoreSettings();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-medium">General Settings</h2>
        <p className="text-sm text-gray-500">
          Configure global platform settings, currency, and receipt details.
        </p>
      </div>

      <GeneralSettingsForm initialData={settings} />
    </div>
  );
}
