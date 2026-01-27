"use client";

import Image from "next/image";
import Link from "next/link";
import { Mail, Calendar, Sparkles, Clock, Shield, Zap, ArrowRight, Check } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Image
            src="/logo.svg"
            alt="Zeno"
            width={200}
            height={120}
            className="h-10 w-auto"
          />
          <div className="flex items-center gap-4">
            <Link
              href="/api/auth/login"
              className="text-sm text-zinc-400 transition-colors hover:text-white"
            >
              Log in
            </Link>
            <Link
              href="/api/auth/login"
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition-all hover:bg-zinc-200"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-20">
        {/* Gradient background */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-blue-600/20 via-transparent to-transparent" />
        <div className="pointer-events-none absolute top-0 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-blue-500/30 blur-[120px]" />
        
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-sm text-blue-400">
            <Sparkles className="h-4 w-4" />
            AI-Powered Email Management
          </div>
          
          <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
            Your inbox,
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              finally under control
            </span>
          </h1>
          
          <p className="mx-auto mb-10 max-w-2xl text-lg text-zinc-400 sm:text-xl">
            Zeno reads your emails, surfaces what matters, drafts responses, and books meetings — so you can focus on what&apos;s important.
          </p>
          
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/api/auth/login"
              className="group flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-medium text-black transition-all hover:bg-zinc-200"
            >
              Start Free Trial
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <p className="text-sm text-zinc-500">No credit card required</p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-white/10 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">How Zeno Works</h2>
            <p className="text-zinc-400">Three simple steps to inbox freedom</p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
                <Mail className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">1. Connect Gmail</h3>
              <p className="text-zinc-400">
                Securely connect your inbox. Zeno reads your emails but never sends without your approval.
              </p>
            </div>
            
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">2. Zeno Classifies</h3>
              <p className="text-zinc-400">
                AI categorizes every email: needs response, calendar invite, FYI, or noise. No more guessing.
              </p>
            </div>
            
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">3. Take Action</h3>
              <p className="text-zinc-400">
                Review AI-drafted responses, approve meetings, and clear your inbox in minutes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="border-t border-white/10 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Everything You Need</h2>
            <p className="text-zinc-400">Powerful features to transform your email workflow</p>
          </div>
          
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<Mail className="h-5 w-5" />}
              title="Smart Classification"
              description="AI categorizes emails by urgency and required action"
            />
            <FeatureCard
              icon={<Sparkles className="h-5 w-5" />}
              title="Auto-Draft Responses"
              description="Get intelligent reply drafts that match your tone"
            />
            <FeatureCard
              icon={<Calendar className="h-5 w-5" />}
              title="Calendar Integration"
              description="Book meetings and manage invites automatically"
            />
            <FeatureCard
              icon={<Clock className="h-5 w-5" />}
              title="Daily Digests"
              description="Get a summary of what needs attention each morning"
            />
            <FeatureCard
              icon={<Shield className="h-5 w-5" />}
              title="Privacy First"
              description="Your data is never used to train AI models"
            />
            <FeatureCard
              icon={<Zap className="h-5 w-5" />}
              title="Lightning Fast"
              description="Process hundreds of emails in seconds"
            />
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="border-t border-white/10 py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 sm:p-12">
            <p className="mb-6 text-xl text-zinc-300 sm:text-2xl">
              &ldquo;Zeno&apos;s Email Agent is a gamechanger to start my day. My inbox is finally under control.&rdquo;
            </p>
            <div className="flex items-center justify-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400" />
              <span className="font-medium">Early Zeno User</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-white/10 py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Ready to take back your inbox?</h2>
          <p className="mb-8 text-zinc-400">
            Join thousands of professionals who save hours every week with Zeno.
          </p>
          <Link
            href="/api/auth/login"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-lg font-medium text-black transition-all hover:bg-zinc-200"
          >
            Get Started Free
            <ArrowRight className="h-5 w-5" />
          </Link>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-zinc-500">
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-500" />
              Free 14-day trial
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-500" />
              No credit card required
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-500" />
              Cancel anytime
            </span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <Image
              src="/logo.svg"
              alt="Zeno"
              width={100}
              height={32}
              className="h-6 w-auto opacity-50"
            />
            <div className="flex items-center gap-6 text-sm text-zinc-500">
              <Link href="/terms" className="transition-colors hover:text-white">
                Terms
              </Link>
              <Link href="/privacy" className="transition-colors hover:text-white">
                Privacy
              </Link>
              <span>© 2026 xix3D Inc.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 transition-colors hover:border-white/20 hover:bg-white/[0.07]">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
        {icon}
      </div>
      <h3 className="mb-1.5 font-semibold">{title}</h3>
      <p className="text-sm text-zinc-400">{description}</p>
    </div>
  );
}
