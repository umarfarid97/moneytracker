import { SUBSCRIPTIONS, SUBSCRIPTION_GROUPS, subscriptionFor, subscriptionsIn } from '@/domain/subscriptions';

describe('subscription presets', () => {
  test('ids and names are unique and every group has services', () => {
    expect(new Set(SUBSCRIPTIONS.map((s) => s.id)).size).toBe(SUBSCRIPTIONS.length);
    expect(new Set(SUBSCRIPTIONS.map((s) => s.name)).size).toBe(SUBSCRIPTIONS.length);
    for (const g of SUBSCRIPTION_GROUPS) expect(subscriptionsIn(g).length).toBeGreaterThan(0);
  });

  test('matches common services by name or alias', () => {
    expect(subscriptionFor('Netflix Premium')?.id).toBe('netflix');
    expect(subscriptionFor('Google Drive 200GB')?.id).toBe('google-one');
    expect(subscriptionFor('Claude Pro')?.id).toBe('claude');
    expect(subscriptionFor('Apple iCloud')?.id).toBe('icloud');
    expect(subscriptionFor('Netflix')).toMatchObject({ category: 'Hiburan' });
    expect(subscriptionFor('Gym')).toMatchObject({ category: 'Kesihatan' });
    expect(subscriptionFor('Mom\'s birthday')).toBeNull();
  });
});
