import { redirect } from 'next/navigation';
import { getClientByToken, getAuthedClientId, getIntakeByClientId } from '@/lib/portal';
import Intake from './Intake';

export const dynamic = 'force-dynamic';

export default async function IntakePage({ params }) {
  const { token } = params;
  const client = await getClientByToken(token);
  if (!client || client.archived) redirect(`/p/${token}`);
  if (getAuthedClientId() !== client.id) redirect(`/p/${token}`);

  const existing = await getIntakeByClientId(client.id);

  // Prefill what we already know about the client. There's no separate first
  // name on the client record (display_name is the welcome name), so first
  // name is left for them to fill.
  const prefill = {
    last_name: existing?.last_name ?? client.last_name ?? '',
    email: existing?.email ?? client.email ?? '',
    event_date: existing?.event_date ?? client.event_date ?? '',
  };

  return <Intake token={token} welcomeName={client.display_name} existing={existing} prefill={prefill} />;
}
