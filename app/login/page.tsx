'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('demo@meetingprep.app');
  const [password, setPassword] = useState('demo1234');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // If already logged in, redirect to /app
    if (typeof window !== 'undefined') {
      const hasCookie = document.cookie.includes('demo_session=1');
      const hasLocal = localStorage.getItem('demo_session') === 'true';
      if (hasCookie || hasLocal) {
        router.push('/app');
      }
    }
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please provide both email and password.');
      return;
    }
    if (isSignUp && !name.trim()) {
      setError('Please provide your name to create an account.');
      return;
    }

    // Set demo session cookie and localStorage
    document.cookie = 'demo_session=1; path=/; max-age=604800';
    localStorage.setItem('demo_session', 'true');
    localStorage.setItem('demo_user_email', email.trim());
    if (name.trim()) {
      localStorage.setItem('demo_user_name', name.trim());
    }

    router.push('/app');
  };

  return (
    <div className="min-h-screen bg-[#e6dfd3] text-[#2a2622] flex flex-col font-sans">
      {/* Top Bar */}
      <header className="px-6 py-5 max-w-5xl w-full mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="w-3 h-3 bg-[#b8623f] rounded-full inline-block" />
          <span className="font-heading font-semibold text-base tracking-tight text-[#2a2622]">
            Meeting Prep Agent
          </span>
        </Link>
        <Link
          href="/"
          className="px-4 py-1.5 text-xs font-medium clay-btn-secondary"
        >
          Back to Overview
        </Link>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="clay-card p-8 sm:p-10 space-y-6">
            {/* Header */}
            <div className="text-center space-y-1.5">
              <h1 className="font-heading text-2xl font-bold text-[#2a2622]">
                {isSignUp ? 'Create Demo Account' : 'Sign in to Demo'}
              </h1>
              <p className="text-xs text-[#6e665d]">
                Enterprise relationship memory and pre-meeting briefing system
              </p>
            </div>

            {/* Toggle Mode */}
            <div className="clay-inset p-1 flex rounded-[22px]">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setError('');
                }}
                className={`flex-1 py-1.5 text-xs font-medium rounded-[18px] transition-all ${
                  !isSignUp
                    ? 'clay-btn-secondary font-semibold text-[#2a2622]'
                    : 'text-[#6e665d] hover:text-[#2a2622]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setError('');
                }}
                className={`flex-1 py-1.5 text-xs font-medium rounded-[18px] transition-all ${
                  isSignUp
                    ? 'clay-btn-secondary font-semibold text-[#2a2622]'
                    : 'text-[#6e665d] hover:text-[#2a2622]'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Honest Demo Notice */}
            <div className="p-3.5 clay-inset text-xs text-[#524a41] leading-relaxed">
              <span className="font-semibold text-[#b8623f] block mb-0.5">
                Notice: Demo mode
              </span>
              Use <code className="font-mono text-[11px] font-semibold text-[#2a2622]">demo@meetingprep.app</code> / <code className="font-mono text-[11px] font-semibold text-[#2a2622]">demo1234</code> or create any account. Data is not stored on a server.
            </div>

            {error && (
              <div className="p-2.5 text-xs text-[#8f3e3e] bg-[#ede2df] border border-[#d8bebe] rounded-[16px]">
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-[#443e37]">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Morgan"
                    className="w-full px-3.5 py-2 text-xs clay-input"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#443e37]">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="demo@meetingprep.app"
                  className="w-full px-3.5 py-2 text-xs clay-input"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#443e37]">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="demo1234"
                  className="w-full px-3.5 py-2 text-xs clay-input"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 text-xs font-semibold clay-btn-primary mt-2"
              >
                {isSignUp ? 'Create Demo Session' : 'Enter Demo Application'}
              </button>
            </form>

            {/* Bottom footnote */}
            <div className="pt-2 text-center text-[11px] text-[#7d756b]">
              Protected prototype environment. Client session only.
            </div>
          </div>
        </div>
      </main>

      <footer className="py-5 text-center text-xs text-[#7d756b]">
        Meeting Prep Agent Demo. Memory powered by Hindsight.
      </footer>
    </div>
  );
}
