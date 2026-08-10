import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Zap, BarChart3, Search, Target } from 'lucide-react';

export default function Login() {
  const { signIn, user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  let from = (location.state as any)?.from?.pathname || '/dashboard';
  if (from === '/') from = '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Already logged in — bounce to app
  if (!authLoading && user) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      setIsLoading(false);
      if (error.includes('Email not confirmed')) {
        setError('Please check your email and confirm your account first.');
      } else if (error.includes('Invalid login credentials')) {
        setError('Incorrect email or password. Please try again.');
      } else {
        setError(error);
      }
      return;
    }

    navigate(from, { replace: true });
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Left — Branding Panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 text-white relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-40 -right-20 w-[500px] h-[500px] rounded-full bg-white/5" />
        <div className="absolute top-1/3 right-0 w-64 h-64 rounded-full bg-white/5" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg">
              <span className="font-bold text-indigo-700 text-xl">L</span>
            </div>
            <span className="font-bold text-2xl tracking-tight">LeadEngine</span>
          </div>
          <h1 className="text-4xl font-extrabold leading-tight mb-4">
            Find your next
            <br />
            <span className="text-indigo-200">1,000 customers.</span>
          </h1>
          <p className="text-indigo-100 text-lg leading-relaxed max-w-sm">
            Multi-source lead discovery, enrichment, and intelligence — fully automated.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-4">
          {[
            { icon: Search, label: 'Smart Discovery', desc: 'Scrape 8+ sources instantly' },
            { icon: Target, label: 'Deduplication', desc: 'AI-powered dedup engine' },
            { icon: BarChart3, label: 'Intelligence', desc: 'Auto company profiles' },
            { icon: Zap, label: 'Pipelines', desc: 'Automated outreach flows' },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <Icon className="w-5 h-5 mb-2 text-indigo-200" />
              <div className="font-semibold text-sm">{label}</div>
              <div className="text-indigo-200 text-xs mt-0.5">{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right — Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="font-bold text-primary-foreground">L</span>
            </div>
            <span className="font-bold text-xl">LeadEngine</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-foreground">Welcome back</h2>
            <p className="text-muted-foreground mt-2">Sign in to your workspace to continue.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="login-email">Email address</Label>
              <Input
                id="login-email"
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
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              id="login-submit"
              type="submit"
              className="w-full h-11 font-semibold"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link to="/signup" className="font-semibold text-primary hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
