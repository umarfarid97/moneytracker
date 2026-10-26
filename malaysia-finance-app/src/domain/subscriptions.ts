import { matcher } from './brandMatch';

/**
 * Ready-made subscriptions offered when adding a Subscription, apart from the bill billers in billers.ts.
 * Like the billers they have no logo files: a circle in a brand-like colour with initials, matched to a
 * subscription by its name, so nothing extra is stored or synced.
 */
export type SubscriptionGroup = 'streaming' | 'cloud' | 'ai' | 'apps' | 'life';

export type SubscriptionService = {
  id: string;
  /** Name given to a new subscription picked from the list. */
  name: string;
  group: SubscriptionGroup;
  /** Name of the category the payments are recorded under. */
  category: 'Bil' | 'Hiburan' | 'Kesihatan';
  initials: string;
  color: string;
  ink: string;
  aliases: string[];
};

export const SUBSCRIPTION_GROUPS: SubscriptionGroup[] = ['streaming', 'cloud', 'ai', 'apps', 'life'];

const WHITE = '#ffffff';
const sub = (
  id: string, name: string, group: SubscriptionGroup, initials: string, color: string, ink: string,
  o: Partial<Pick<SubscriptionService, 'category' | 'aliases'>> = {},
): SubscriptionService => ({
  id, name, group, initials, color, ink,
  category: o.category ?? (group === 'streaming' ? 'Hiburan' : 'Bil'), aliases: o.aliases ?? [],
});

/** Order matters for matching: the first service whose name or alias appears wins. */
export const SUBSCRIPTIONS: SubscriptionService[] = [
  sub('netflix', 'Netflix', 'streaming', 'N', '#e50914', WHITE),
  sub('disney', 'Disney+ Hotstar', 'streaming', 'D+', '#113ccf', WHITE, { aliases: ['disney plus', 'disney', 'hotstar'] }),
  sub('youtube', 'YouTube Premium', 'streaming', 'YT', '#ff0000', WHITE, { aliases: ['youtube'] }),
  sub('spotify', 'Spotify', 'streaming', 'S', '#1db954', '#111111'),
  sub('apple-music', 'Apple Music', 'streaming', 'AM', '#fa243c', WHITE),
  sub('astro', 'Astro', 'streaming', 'A', '#0033a0', WHITE, { aliases: ['astro njoi', 'astro go'] }),
  sub('viu', 'Viu', 'streaming', 'V', '#ffb400', '#1a1a1a'),
  sub('wetv', 'WeTV', 'streaming', 'WE', '#ff6a00', WHITE, { aliases: ['we tv'] }),

  sub('google-one', 'Google One', 'cloud', 'G1', '#1a73e8', WHITE, { aliases: ['google drive', 'google storage', 'gdrive'] }),
  sub('icloud', 'Apple iCloud', 'cloud', 'iC', '#3b82f6', WHITE, { aliases: ['icloud', 'icloud+'] }),
  sub('dropbox', 'Dropbox', 'cloud', 'D', '#0061ff', WHITE),

  sub('claude', 'Claude', 'ai', 'C', '#d97757', WHITE, { aliases: ['claude ai', 'anthropic'] }),
  sub('chatgpt', 'ChatGPT', 'ai', 'GP', '#10a37f', WHITE, { aliases: ['openai', 'chat gpt'] }),
  sub('gemini', 'Google Gemini', 'ai', 'GM', '#6d5ae6', WHITE, { aliases: ['gemini'] }),

  sub('microsoft-365', 'Microsoft 365', 'apps', 'M3', '#d83b01', WHITE, { aliases: ['office 365', 'microsoft office'] }),
  sub('canva', 'Canva', 'apps', 'Ca', '#00c4cc', WHITE),
  sub('adobe', 'Adobe', 'apps', 'Ad', '#fa0f00', WHITE, { aliases: ['adobe creative cloud', 'photoshop'] }),
  sub('notion', 'Notion', 'apps', 'No', '#111111', WHITE),

  sub('gym', 'Gym', 'life', 'G', '#0f766e', WHITE, { category: 'Kesihatan', aliases: ['gym membership', 'fitness'] }),
  sub('grab', 'GrabUnlimited', 'life', 'Gr', '#00b14f', WHITE, { aliases: ['grab unlimited'] }),
];

/** The subscription a name refers to (so "Netflix Premium" is Netflix), or null for custom names. */
export const subscriptionFor = matcher(SUBSCRIPTIONS);

export const subscriptionsIn = (group: SubscriptionGroup): SubscriptionService[] => SUBSCRIPTIONS.filter((x) => x.group === group);
