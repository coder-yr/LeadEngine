import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, CheckCircle2, Mail } from 'lucide-react';

export default function Signup() {
  const { signUp, user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [requiresConfirmation, setRequiresConfirmation] = useState(false);

  if (!authLoading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const validate = (): string | null => {
    if (!email) return 'Email is required.';
    if (!/\S+@\S+\.\S+/.test(email)) return 'Please enter a valid email address.';
    if (!password) return 'Password is required.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (password !== confirmPassword) return 'Passwords do not match.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    const { error, requiresConfirmation } = await signUp(email, password);
    setIsLoading(false);

    if (error) {
      if (error.includes('User already registered')) {
        setError('An account with this email already exists. Please sign in instead.');
      } else {
        setError(error);
      }
      return;
    }

    if (requiresConfirmation) {
      setRequiresConfirmation(true);
    } else {
      // Email confirmation disabled — user is immediately signed in
      navigate('/dashboard', { replace: true });
    }
  };

  // Email confirmation required state
  if (requiresConfirmation) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-8">
        <div className="w-full max-w-md text-center space-y-5">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold">Check your inbox</h2>
          <p className="text-muted-foreground leading-relaxed">
            We sent a confirmation link to <strong>{email}</strong>. Click the link in the email to activate your account.
          </p>
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-4 py-3 text-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Account created successfully. Awaiting email confirmation.</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Already confirmed?{' '}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Left — Branding Panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center p-12 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 text-white relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-40 -right-20 w-[500px] h-[500px] rounded-full bg-white/5" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg">
              <span className="font-bold text-indigo-700 text-xl">L</span>
            </div>
            <span className="font-bold text-2xl tracking-tight">LeadEngine</span>
          </div>
          <h1 className="text-4xl font-extrabold leading-tight mb-4">
            Start discovering
            <br />
            <span className="text-indigo-200">leads today.</span>
          </h1>
          <p className="text-indigo-100 text-lg leading-relaxed max-w-sm">
            Create your workspace and start finding high-quality leads from multiple sources in minutes.
          </p>
        </div>
      </div>

      {/* Right — Signup Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="font-bold text-primary-foreground">L</span>
            </div>
            <span className="font-bold text-xl">LeadEngine</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-foreground">Create your account</h2>
            <p className="text-muted-foreground mt-2">Start your free workspace. No credit card required.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="signup-email">Email address</Label>
              <Input
                id="signup-email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                disabled={isLoading}
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-password">Password</Label>
              <Input
                id="signup-password"
                type="password"
                placeholder="Min 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-confirm-password">Confirm password</Label>
              <Input
                id="signup-confirm-password"
                type="password"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
                className="h-11"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              id="signup-submit"
              type="submit"
              className="w-full h-11 font-semibold"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Creating account…
                </span>
              ) : (
                'Create account'
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
