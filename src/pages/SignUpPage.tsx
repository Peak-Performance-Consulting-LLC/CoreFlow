import { AuthLayout } from '../components/auth/AuthLayout';
import { SignUpForm } from '../components/auth/SignUpForm';

export function SignUpPage() {
  return (
    <AuthLayout
      eyebrow="Create account"
      title="Launch your workspace and choose the CRM mode that fits your business."
      description="Sign up, define your workspace, select an industry mode, and enter a personalized dashboard powered by Supabase auth and edge functions."
      footer={
        <p>
          Workspace creation happens during signup, so you leave onboarding with a ready-to-enter dashboard route.
        </p>
      }
    >
      <SignUpForm />
    </AuthLayout>
  );
}
