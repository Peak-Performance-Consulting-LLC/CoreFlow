import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { completeSignup } from '../../lib/auth-helpers';
import { getSupabaseClient } from '../../lib/supabaseClient';
import { getDashboardPath, isValidWorkspaceSlug, slugify } from '../../lib/utils';
import type { CRMType } from '../../lib/types';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/Button';
import { ConfigurationNotice } from '../ui/ConfigurationNotice';
import { Input } from '../ui/Input';
import { WorkspaceSetupFields } from './WorkspaceSetupFields';

type FormErrors = Partial<
  Record<
    | 'fullName'
    | 'email'
    | 'password'
    | 'confirmPassword'
    | 'workspaceName'
    | 'workspaceSlug'
    | 'crmType'
    | 'terms',
    string
  >
>;

export function SignUpForm() {
  const navigate = useNavigate();
  const { isSupabaseReady, refreshWorkspace } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [crmType, setCrmType] = useState<CRMType>('real-estate');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  function validateForm() {
    const nextErrors: FormErrors = {};

    if (fullName.trim().length < 2) nextErrors.fullName = 'Enter your full name.';
    if (!/\S+@\S+\.\S+/.test(email)) nextErrors.email = 'Enter a valid email address.';
    if (!/^(?=.*\d).{8,}$/.test(password)) {
      nextErrors.password = 'Use at least 8 characters and include a number.';
    }
    if (confirmPassword !== password) nextErrors.confirmPassword = 'Passwords do not match.';
    if (workspaceName.trim().length < 2) nextErrors.workspaceName = 'Workspace name is required.';
    if (!isValidWorkspaceSlug(workspaceSlug)) {
      nextErrors.workspaceSlug = 'Use 3+ lowercase characters, numbers, and hyphens only.';
    }
    if (!crmType) nextErrors.crmType = 'Choose a CRM mode.';
    if (!termsAccepted) nextErrors.terms = 'You need to accept the terms to continue.';

    return nextErrors;
  }

  function updateWorkspaceName(value: string) {
    setWorkspaceName(value);

    if (!slugTouched) {
      setWorkspaceSlug(slugify(value));
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateForm();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    if (!isSupabaseReady) {
      toast.error('Add your Supabase environment variables to enable sign up.');
      return;
    }

    setLoading(true);

    try {
      const client = getSupabaseClient();
      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (error) {
        throw error;
      }

      let session = data.session;

      if (!session) {
        const signInResult = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInResult.error) {
          toast.success('Account created. Verify your email, then sign in to finish onboarding.');
          navigate('/signin', { replace: true, state: { prefillEmail: email.trim() } });
          return;
        }

        session = signInResult.data.session;
      }

      if (!session) {
        throw new Error('Unable to open a session after signup.');
      }

      const workspace = await completeSignup(
        {
          full_name: fullName.trim(),
          workspace_name: workspaceName.trim(),
          workspace_slug: workspaceSlug.trim(),
          crm_type: crmType,
        },
        session,
      );

      await refreshWorkspace(session);
      toast.success('Workspace created. Welcome to CoreFlow.');
      navigate(getDashboardPath(workspace), { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to complete signup.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {!isSupabaseReady ? <ConfigurationNotice /> : null}
      <div className="grid gap-5 md:grid-cols-2">
        <Input
          label="Full name"
          placeholder="Jordan Lee"
          autoComplete="name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          error={errors.fullName}
        />
        <Input
          label="Email"
          type="email"
          placeholder="you@company.com"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          placeholder="Create a password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
          hint="At least 8 characters and one number."
          rightElement={
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="text-slate-400 transition hover:text-white"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />
        <Input
          label="Confirm password"
          type={showConfirmPassword ? 'text' : 'password'}
          placeholder="Repeat your password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          error={errors.confirmPassword}
          rightElement={
            <button
              type="button"
              onClick={() => setShowConfirmPassword((current) => !current)}
              className="text-slate-400 transition hover:text-white"
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />
      </div>

      <WorkspaceSetupFields
        workspaceName={workspaceName}
        workspaceSlug={workspaceSlug}
        crmType={crmType}
        errors={errors}
        onWorkspaceNameChange={updateWorkspaceName}
        onWorkspaceSlugChange={(value) => {
          setSlugTouched(true);
          setWorkspaceSlug(slugify(value));
        }}
        onCrmTypeChange={setCrmType}
      />

      <div className="space-y-3">
        <label className="inline-flex items-start gap-3 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(event) => setTermsAccepted(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-950 text-cyan-300 focus:ring-cyan-300"
          />
          <span>
            I agree to the terms, privacy expectations, and workspace ownership rules for this launch build.
          </span>
        </label>
        {errors.terms ? <p className="text-xs text-rose-300">{errors.terms}</p> : null}
      </div>

      <Button type="submit" className="w-full" loading={loading}>
        Create account and workspace
      </Button>

      <p className="text-sm text-slate-400">
        Already have an account?{' '}
        <Link to="/signin" className="font-medium text-cyan-200 transition hover:text-cyan-100">
          Sign in
        </Link>
      </p>
    </form>
  );
}
