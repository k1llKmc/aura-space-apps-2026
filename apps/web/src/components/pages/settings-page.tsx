'use client';
import { useRef, useState, type FormEvent } from 'react';
import {
  UserRole,
  type AuthUser,
  type CreateUserRequest,
} from '@aura/shared-types';
import { useSession } from '@/components/auth/session-provider';
import { useWorkspace } from '@/components/shell/workspace-provider';
import { useNotifications } from '@/components/ui/notifications';
import {
  Badge,
  Button,
  ErrorState,
  Modal,
  PageHeader,
} from '@/components/ui/ui';
import { apiClient } from '@/services/api/client';
const permissions: Record<UserRole, string> = {
  COMMANDER:
    'Mission crew health, warnings, simulations and account provisioning.',
  MEDICAL_OFFICER:
    'Mission crew health, reference policies, warnings and simulations.',
  CREW_MEMBER:
    'Your own health profile and daily checks, mission-wide warnings and reference protocols.',
};
export function SettingsPage() {
  const session = useSession(),
    { mission, roster } = useWorkspace(),
    { notify } = useNotifications();
  const [draft, setDraft] = useState<CreateUserRequest>();
  const [created, setCreated] = useState<AuthUser>();
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [role, setRole] = useState<UserRole>('CREW_MEMBER');
  const form = useRef<HTMLFormElement>(null);
  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const fields = new FormData(event.currentTarget),
      crewMemberId = String(fields.get('crewMemberId') || '');
    setDraft({
      username: String(fields.get('username')).trim().toLowerCase(),
      password: String(fields.get('password')),
      role,
      ...(crewMemberId ? { crewMemberId } : {}),
    });
  }
  async function create() {
    if (!draft) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await apiClient.post<AuthUser>('/auth/users', draft);
      setCreated(data);
      setDraft(undefined);
      form.current?.reset();
      setRole('CREW_MEMBER');
      notify(`Account created for ${data.username}.`);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Unable to create account.',
      );
    } finally {
      setBusy(false);
    }
  }
  if (!session.user) return null;
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Workspace / Account"
        title="Settings / Access"
        description="Review your session, mission permissions and account provisioning options."
      />
      <div className="settings-grid">
        <section className="panel section-panel space-y-5">
          <div className="section-heading">
            <h2>Your account</h2>
            <Badge value={session.user.role} />
          </div>
          <dl className="review-grid">
            <div>
              <dt>Username</dt>
              <dd>{session.user.username}</dd>
            </div>
            <div>
              <dt>Assigned mission</dt>
              <dd>{mission.data?.name || 'Loading mission…'}</dd>
            </div>
            <div>
              <dt>Session expires</dt>
              <dd>
                {session.expiresAt
                  ? new Date(session.expiresAt).toLocaleTimeString()
                  : '—'}
              </dd>
            </div>
            <div>
              <dt>API connection</dt>
              <dd>
                {mission.error
                  ? 'Unavailable'
                  : mission.data
                    ? 'Connected'
                    : 'Connecting'}
              </dd>
            </div>
          </dl>
          <p className="muted">{permissions[session.user.role]}</p>
          <Button
            onClick={async () => {
              try {
                await session.refreshUser();
                notify('Account permissions refreshed.', 'info');
              } catch (reason) {
                notify(
                  reason instanceof Error
                    ? reason.message
                    : 'Unable to refresh permissions.',
                  'error',
                );
              }
            }}
          >
            Refresh account permissions
          </Button>
        </section>
        <section className="panel section-panel space-y-4">
          <h2>Workspace behaviour</h2>
          <p className="muted">
            Mission telemetry and active warnings refresh every 15 seconds.
            Delayed or failed refreshes are shown explicitly.
          </p>
          <p className="muted">
            Sessions are kept in memory, expire after 15 minutes and are revoked
            when you sign out. Reloading the site requires sign-in.
          </p>
          <p className="muted">
            Access is enforced by your onboard account and assigned mission.
            Interface visibility does not grant additional permissions.
          </p>
        </section>
      </div>
      {session.user.role === 'COMMANDER' ? (
        <section className="panel section-panel space-y-5">
          <div className="section-heading">
            <h2>Create a mission account</h2>
            <Badge value="COMMANDER" label="Commander access" />
          </div>
          <p className="muted">
            New accounts are assigned to your mission. A Crew Member account
            must be linked to a crew profile. Passwords are not displayed after
            creation.
          </p>
          {roster.error && (
            <ErrorState message={roster.error} retry={roster.refresh} />
          )}
          <form ref={form} onSubmit={review} className="space-y-5">
            <fieldset disabled={busy} className="form-grid">
              <label>
                New username
                <input
                  name="username"
                  aria-label="New username"
                  aria-describedby="new-username-hint"
                  required
                  minLength={3}
                  maxLength={64}
                  pattern="[A-Za-z0-9_.-]{3,64}"
                  autoComplete="off"
                />
                <span id="new-username-hint" className="field-hint">
                  3–64 letters, digits, dots, underscores or hyphens
                </span>
              </label>
              <label>
                Initial password
                <input
                  name="password"
                  aria-label="Initial password"
                  aria-describedby="initial-password-hint"
                  type="password"
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                />
                <span id="initial-password-hint" className="field-hint">12–128 characters</span>
              </label>
              <label>
                Account role
                <select
                  aria-label="Account role"
                  value={role}
                  onChange={(event) => setRole(event.target.value as UserRole)}
                >
                  {Object.values(UserRole).map((value) => (
                    <option key={value} value={value}>
                      {value.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Linked crew profile
                <select
                  name="crewMemberId"
                  aria-label="Linked crew profile"
                  required={role === 'CREW_MEMBER'}
                  defaultValue=""
                >
                  <option value="">
                    {role === 'CREW_MEMBER'
                      ? 'Choose a crew profile'
                      : 'No linked profile'}
                  </option>
                  {roster.data?.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
            {error && <ErrorState message={error} />}
            <Button
              type="submit"
              variant="primary"
              disabled={busy || roster.loading}
            >
              Review account
            </Button>
          </form>
          {created && (
            <div role="status" className="success-panel">
              Account <strong>{created.username}</strong> created with role{' '}
              {created.role.replaceAll('_', ' ')}.
            </div>
          )}
        </section>
      ) : (
        <section className="panel section-panel">
          <h2 className="mb-3">Account administration</h2>
          <p className="muted">
            Only a Commander can create mission accounts. Contact your mission
            Commander to change access or provision another account.
          </p>
        </section>
      )}
      <Modal
        open={!!draft}
        title="Confirm mission access"
        busy={busy}
        onClose={() => {
          setDraft(undefined);
          setError('');
        }}
      >
        {draft && (
          <div className="space-y-4">
            <dl className="review-grid">
              <div>
                <dt>Username</dt>
                <dd>{draft.username}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{draft.role.replaceAll('_', ' ')}</dd>
              </div>
              <div>
                <dt>Linked profile</dt>
                <dd>
                  {roster.data?.find(
                    (member) => member.id === draft.crewMemberId,
                  )?.name || 'None'}
                </dd>
              </div>
              <div>
                <dt>Mission</dt>
                <dd>{mission.data?.name || 'Your assigned mission'}</dd>
              </div>
            </dl>
            <p className="muted">{permissions[draft.role]}</p>
            {error && <ErrorState message={error} />}
            <Button variant="primary" disabled={busy} onClick={create}>
              {busy ? 'Creating account…' : 'Create account'}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
