import React, { useState } from 'react';
import { ArrowRight, LogIn, UserPlus } from 'lucide-react';
import { login, signup } from '../../services/auth';

type AuthScreenProps = {
  onAuthenticated: () => void;
};

const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      if (mode === 'signup') {
        await signup(email, password, firstName, lastName);
      }

      await login(email, password);
      onAuthenticated();
    } catch (err: any) {
      setError(err?.message || 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.2),_transparent_32%),linear-gradient(180deg,#08111f_0%,#0f172a_55%,#111827_100%)] text-white">
      <div className="w-full max-w-5xl grid lg:grid-cols-[1.15fr_0.85fr] overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 shadow-2xl shadow-black/30 backdrop-blur">
        <div className="p-8 sm:p-10 lg:p-12 border-b lg:border-b-0 lg:border-r border-white/10">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-400/10 px-3 py-1 text-xs font-medium text-indigo-200">
            <LogIn size={13} /> Secure access
          </div>
          <h1 className="mt-6 text-4xl sm:text-5xl font-semibold tracking-tight">IntervAI</h1>
          <p className="mt-4 max-w-xl text-sm sm:text-base text-slate-300 leading-6">
            Sign in to continue your interview workspace, resume feedback, coaching history, and saved account settings.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              ['Private account', 'Your profile and sessions stay tied to your login.'],
              ['Fast access', 'Return to the dashboard instantly after signing in.'],
              ['Unified workspace', 'Keep interview, resume, and coaching tools in one place.'],
            ].map(([title, description]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-medium text-white">{title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="p-8 sm:p-10 lg:p-12 bg-slate-900/70">
          <div className="mb-8 flex rounded-2xl border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium transition ${mode === 'login' ? 'bg-white text-slate-950' : 'text-slate-300 hover:text-white'}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium transition ${mode === 'signup' ? 'bg-white text-slate-950' : 'text-slate-300 hover:text-white'}`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="text-slate-300">First name</span>
                  <input
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none ring-0 placeholder:text-slate-500 focus:border-indigo-400"
                    placeholder="Alex"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-slate-300">Last name</span>
                  <input
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none ring-0 placeholder:text-slate-500 focus:border-indigo-400"
                    placeholder="Johnson"
                  />
                </label>
              </div>
            )}

            <label className="block space-y-2 text-sm">
              <span className="text-slate-300">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none ring-0 placeholder:text-slate-500 focus:border-indigo-400"
                placeholder="you@example.com"
                required
              />
            </label>

            <label className="block space-y-2 text-sm">
              <span className="text-slate-300">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none ring-0 placeholder:text-slate-500 focus:border-indigo-400"
                placeholder="••••••••"
                required
              />
            </label>

            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {mode === 'login' ? <LogIn size={16} /> : <UserPlus size={16} />}
              {busy ? 'Working...' : mode === 'login' ? 'Continue' : 'Create account'}
              <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;