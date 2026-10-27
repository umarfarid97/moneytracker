import { useCallback, useEffect, useState } from 'react';
import { Share, View } from 'react-native';
import { t } from '@/i18n/t';
import { CloudCodeError, CloudRateError, type CloudDevice } from '@/sync/cloudApi';
import { WrongSecretError } from '@/sync/cryptoBox';
import { lastSyncedText } from '@/sync/lastSynced';
import { useSync } from '@/sync/SyncProvider';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { confirmDelete } from '@/ui/confirm';
import { IconBadge } from '@/ui/IconBadge';
import { Screen } from '@/ui/Screen';
import { TextField } from '@/ui/TextField';

const MIN_PASSPHRASE = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Turns a failed call into a sentence for the person. */
function failure(e: unknown): string {
  if (e instanceof CloudCodeError) return t('cloud.fail.code');
  if (e instanceof CloudRateError) return t('cloud.fail.rate');
  if (e instanceof WrongSecretError) return t('cloud.fail.wrong');
  if (e instanceof TypeError) return t('cloud.fail.network');
  if (e instanceof Error && e.message === 'Keys already exist') return t('cloud.fail.exists');
  return t('cloud.fail.unknown');
}

/** More > Backup & sync > Duit cloud: sign in with an email code, choose a passphrase, and manage this account. */
export default function Cloud() {
  const sync = useSync();
  // Stays on screen after the import so its result can be read.
  const [showDrive, setShowDrive] = useState(false);
  useEffect(() => {
    if (sync.drive.pending) setShowDrive(true);
  }, [sync.drive.pending]);
  return (
    <Screen>
      <BackButton />
      <AppText variant="title">{t('cloud.title')}</AppText>
      {!sync.available ? (
        <Card>
          <AppText variant="small" tone="muted">
            {t('cloud.unavailable')}
          </AppText>
        </Card>
      ) : sync.step === 'off' ? (
        <SignIn />
      ) : sync.step === 'create' ? (
        <Create />
      ) : sync.step === 'unlock' ? (
        <Unlock />
      ) : (
        <Ready />
      )}
      {showDrive ? <DriveImport /> : null}
    </Screen>
  );
}

function Notice({ text, tone = 'negative' }: { text: string | null; tone?: 'negative' | 'positive' }) {
  return text ? (
    <AppText variant="small" tone={tone}>
      {text}
    </AppText>
  ) : null;
}

function SignIn() {
  const sync = useSync();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function send() {
    const address = email.trim().toLowerCase();
    if (!EMAIL.test(address)) return setNote(t('cloud.fail.unknown'));
    setBusy(true);
    setNote(null);
    try {
      await sync.sendCode(address);
      setSentTo(address);
      setCode('');
    } catch (e) {
      setNote(failure(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setNote(null);
    try {
      await sync.confirmCode(sentTo!, code.trim());
    } catch (e) {
      setNote(failure(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={{ gap: 14 }}>
      <AppText variant="small" tone="muted">
        {t('cloud.intro')}
      </AppText>
      {sentTo === null ? (
        <>
          <TextField label={t('cloud.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
          <Notice text={note} />
          <Button title={t('cloud.sendCode')} disabled={busy || email.trim() === ''} onPress={() => void send()} />
        </>
      ) : (
        <>
          <AppText variant="small">{t('cloud.codeSent', { email: sentTo })}</AppText>
          <TextField label={t('cloud.code')} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" />
          <Notice text={note} />
          <Button title={t('cloud.verify')} disabled={busy || code.length !== 6} onPress={() => void verify()} />
          <Button title={t('cloud.otherEmail')} variant="secondary" disabled={busy} onPress={() => { setSentTo(null); setNote(null); }} />
        </>
      )}
    </Card>
  );
}

/** Choose the passphrase, then show the recovery key once. */
function Create() {
  const sync = useSync();
  const [pass, setPass] = useState('');
  const [again, setAgain] = useState('');
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function create() {
    if (pass.length < MIN_PASSPHRASE) return setNote(t('cloud.fail.short'));
    if (pass !== again) return setNote(t('cloud.fail.mismatch'));
    setBusy(true);
    setNote(null);
    try {
      setRecoveryKey(await sync.createKeys(pass));
    } catch (e) {
      setNote(failure(e));
    } finally {
      setBusy(false);
    }
  }

  if (recoveryKey) {
    return (
      <Card style={{ gap: 14 }}>
        <AppText variant="section">{t('cloud.recovery.title')}</AppText>
        <AppText variant="small" tone="muted">
          {t('cloud.recovery.body')}
        </AppText>
        <AppText variant="bodyStrong" selectable accessibilityLabel={t('cloud.recoveryKey')} style={{ letterSpacing: 1 }}>
          {recoveryKey}
        </AppText>
        <Button title={t('cloud.recovery.share')} variant="secondary" onPress={() => void Share.share({ message: recoveryKey }).catch(() => {})} />
        <Button title={t('cloud.recovery.saved')} onPress={() => void sync.finishSetup()} />
      </Card>
    );
  }
  return (
    <Card style={{ gap: 14 }}>
      <AppText variant="section">{t('cloud.create.title')}</AppText>
      <AppText variant="small" tone="muted">
        {t('cloud.create.body')}
      </AppText>
      <TextField label={t('cloud.passphrase')} value={pass} onChangeText={setPass} secure textContentType="newPassword" />
      <TextField label={t('cloud.passphraseConfirm')} value={again} onChangeText={setAgain} secure textContentType="newPassword" />
      <Notice text={note} />
      <Button title={t('cloud.create.go')} disabled={busy} onPress={() => void create()} />
      <Button title={t('cloud.signOut')} variant="secondary" disabled={busy} onPress={() => void sync.disconnect()} />
    </Card>
  );
}

function Unlock() {
  const sync = useSync();
  const [useRecovery, setUseRecovery] = useState(false);
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function unlock() {
    setBusy(true);
    setNote(null);
    try {
      await sync.unlock(useRecovery ? { recoveryKey: secret } : { passphrase: secret });
    } catch (e) {
      setNote(failure(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={{ gap: 14 }}>
      <AppText variant="section">{t('cloud.unlock.title')}</AppText>
      <AppText variant="small" tone="muted">
        {t('cloud.unlock.body')}
      </AppText>
      {sync.problem === 'locked' ? (
        <AppText variant="small" tone="warning">
          {t('backup.problem.locked')}
        </AppText>
      ) : null}
      <TextField
        label={useRecovery ? t('cloud.recoveryKey') : t('cloud.passphrase')}
        value={secret}
        onChangeText={setSecret}
        secure={!useRecovery}
        textContentType="password"
      />
      <Notice text={note} />
      <Button title={t('cloud.unlock.go')} disabled={busy || secret === ''} onPress={() => void unlock()} />
      <Button
        title={useRecovery ? t('cloud.unlock.usePassphrase') : t('cloud.unlock.useRecovery')}
        variant="secondary"
        disabled={busy}
        onPress={() => { setUseRecovery(!useRecovery); setSecret(''); setNote(null); }}
      />
      <Button title={t('cloud.signOut')} variant="secondary" disabled={busy} onPress={() => void sync.disconnect()} />
    </Card>
  );
}

function Ready() {
  const sync = useSync();
  const [devices, setDevices] = useState<{ current: string; devices: CloudDevice[] } | null>(null);
  const [changing, setChanging] = useState(false);
  const [pass, setPass] = useState('');
  const [note, setNote] = useState<{ text: string; tone: 'negative' | 'positive' } | null>(null);

  const refresh = useCallback(() => {
    sync.devices().then(setDevices).catch(() => setDevices(null));
  }, [sync]);
  // Load the list once on opening, not on every sync.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, []);

  async function signOut() {
    const ok = await confirmDelete(t('cloud.signOutTitle'), t('cloud.signOutMessage'), t('cloud.signOut'), t('common.cancel'));
    if (ok) await sync.disconnect();
  }

  async function wipe() {
    const ok = await confirmDelete(t('cloud.deleteTitle'), t('cloud.deleteMessage'), t('cloud.delete'), t('common.cancel'));
    if (!ok) return;
    try {
      await sync.deleteCloudData();
    } catch (e) {
      setNote({ text: failure(e), tone: 'negative' });
    }
  }

  async function savePassphrase() {
    if (pass.length < MIN_PASSPHRASE) return setNote({ text: t('cloud.fail.short'), tone: 'negative' });
    try {
      await sync.changePassphrase(pass);
      setChanging(false);
      setPass('');
      setNote({ text: t('cloud.changed'), tone: 'positive' });
    } catch (e) {
      setNote({ text: failure(e), tone: 'negative' });
    }
  }

  const status = sync.syncing ? t('backup.drive.syncing') : lastSyncedText(sync.lastSyncedAt);
  return (
    <>
      <Card style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconBadge icon="cloud-done-outline" size={36} />
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">{t('cloud.connected', { email: sync.email ?? '' })}</AppText>
            <AppText variant="small" tone="muted">
              {status}
            </AppText>
          </View>
        </View>
        <AppText variant="small" tone="muted">
          {t('cloud.auto')}
        </AppText>
        {sync.problem ? (
          <AppText variant="small" tone="warning">
            {t(`backup.problem.${sync.problem}`)}
          </AppText>
        ) : null}
        <Button title={t('backup.drive.syncNow')} disabled={sync.syncing} onPress={() => void sync.syncNow()} />
        {sync.problem === 'signIn' ? <Button title={t('cloud.signInAgain')} variant="secondary" onPress={() => void sync.disconnect()} /> : null}
      </Card>

      <AppText variant="section">{t('cloud.devices')}</AppText>
      <Card style={{ gap: 12 }}>
        {(devices?.devices ?? []).map((d) => (
          <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">{d.name}</AppText>
              {d.id === devices?.current ? (
                <AppText variant="small" tone="muted">
                  {t('cloud.thisDevice')}
                </AppText>
              ) : null}
            </View>
            {d.id !== devices?.current ? (
              <Button
                compact
                variant="secondary"
                title={t('cloud.removeDevice')}
                accessibilityLabel={`${t('cloud.removeDevice')} ${d.name}`}
                onPress={() => void sync.removeDevice(d.id).then(refresh)}
              />
            ) : null}
          </View>
        ))}
      </Card>

      <Card style={{ gap: 12 }}>
        {changing ? (
          <>
            <TextField label={t('cloud.passphrase')} value={pass} onChangeText={setPass} secure textContentType="newPassword" />
            <Button title={t('cloud.change')} onPress={() => void savePassphrase()} />
          </>
        ) : (
          <Button title={t('cloud.change')} variant="secondary" onPress={() => setChanging(true)} />
        )}
        <Notice text={note?.text ?? null} tone={note?.tone} />
        <Button title={t('cloud.signOut')} variant="secondary" onPress={() => void signOut()} />
        <Button title={t('cloud.delete')} variant="secondary" onPress={() => void wipe()} />
      </Card>
    </>
  );
}

function DriveImport() {
  const sync = useSync();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; tone: 'negative' | 'positive' } | null>(null);
  async function run() {
    setBusy(true);
    setNote(null);
    try {
      await sync.drive.importNow();
      setNote({ text: t('cloud.import.done'), tone: 'positive' });
    } catch {
      setNote({ text: t('cloud.import.failed'), tone: 'negative' });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card style={{ gap: 12 }}>
      <AppText variant="section">{t('cloud.import.title')}</AppText>
      <AppText variant="small" tone="muted">
        {t('cloud.import.body')}
      </AppText>
      <Notice text={note?.text ?? null} tone={note?.tone} />
      {note?.tone === 'positive' ? null : (
        <Button title={t('cloud.import.go')} variant="secondary" disabled={busy} onPress={() => void run()} />
      )}
    </Card>
  );
}
