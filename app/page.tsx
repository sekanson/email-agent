"use client";

import Image from "next/image";
import Link from "next/link";
import { Mail, Calendar, Sparkles, Clock, Shield, Zap, ArrowRight, Check, Star, Users, TrendingUp, Lock, Eye, Brain, MessageSquare, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

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
              href="/login"
              className="text-sm text-zinc-400 transition-colors hover:text-white"
            >
              Log in
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition-all hover:bg-zinc-200"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-20">
        {/* Gradient backgrounds */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-blue-600/20 via-transparent to-transparent" />
        <div className="pointer-events-none absolute top-0 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-blue-500/30 blur-[120px]" />
        
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="text-center">
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
                href="/login"
                className="group flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-medium text-black transition-all hover:bg-zinc-200"
              >
                Start Free Trial
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <p className="text-sm text-zinc-500">No credit card required</p>
            </div>
          </div>

          {/* Product Preview */}
          <div className="mt-16 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-transparent p-2">
            <div className="rounded-xl bg-zinc-900/80 p-4 sm:p-6">
              <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500/80" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                  <div className="h-3 w-3 rounded-full bg-green-500/80" />
                </div>
                <span className="text-xs text-zinc-500">Zeno Dashboard</span>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-white/5 p-4">
                  <div className="text-2xl font-bold text-white">24</div>
                  <div className="text-sm text-zinc-400">Need Response</div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-white/10">
                    <div className="h-full w-3/4 rounded-full bg-red-400" />
                  </div>
                </div>
                <div className="rounded-lg bg-white/5 p-4">
                  <div className="text-2xl font-bold text-white">8</div>
                  <div className="text-sm text-zinc-400">Calendar Invites</div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-white/10">
                    <div className="h-full w-1/4 rounded-full bg-purple-400" />
                  </div>
                </div>
                <div className="rounded-lg bg-white/5 p-4">
                  <div className="text-2xl font-bold text-white">68</div>
                  <div className="text-sm text-zinc-400">Spam Cleared</div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-white/10">
                    <div className="h-full w-full rounded-full bg-emerald-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Stats */}
      <section className="border-t border-white/10 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-white sm:text-4xl">10K+</div>
              <div className="mt-1 text-sm text-zinc-400">Emails Processed Daily</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white sm:text-4xl">2hrs</div>
              <div className="mt-1 text-sm text-zinc-400">Saved Per Week</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white sm:text-4xl">99%</div>
              <div className="mt-1 text-sm text-zinc-400">Classification Accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white sm:text-4xl">4.9</div>
              <div className="mt-1 flex items-center justify-center gap-1 text-sm text-zinc-400">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                User Rating
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-white/10 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-2 text-sm font-medium uppercase tracking-wider text-blue-400">Simple Setup</p>
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Up and running in 3 minutes</h2>
            <p className="mx-auto max-w-2xl text-zinc-400">No complex configuration. Just connect and let Zeno handle the rest.</p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-3">
            <div className="relative rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="absolute -top-3 left-6 rounded-full bg-blue-500 px-3 py-1 text-sm font-bold">1</div>
              <div className="mb-4 mt-2 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
                <Mail className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Connect Gmail</h3>
              <p className="text-zinc-400">
                Securely connect your inbox with one click. We use OAuth — your password stays with Google.
              </p>
            </div>
            
            <div className="relative rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="absolute -top-3 left-6 rounded-full bg-purple-500 px-3 py-1 text-sm font-bold">2</div>
              <div className="mb-4 mt-2 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400">
                <Brain className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">AI Analyzes</h3>
              <p className="text-zinc-400">
                Zeno reads and categorizes every email. Important messages rise to the top. Noise fades away.
              </p>
            </div>
            
            <div className="relative rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="absolute -top-3 left-6 rounded-full bg-emerald-500 px-3 py-1 text-sm font-bold">3</div>
              <div className="mb-4 mt-2 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Take Action</h3>
              <p className="text-zinc-400">
                Review drafts, approve meetings, and clear your inbox. What took hours now takes minutes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Deep Dive */}
      <section className="border-t border-white/10 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-2 text-sm font-medium uppercase tracking-wider text-blue-400">Features</p>
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Everything you need to master your inbox</h2>
            <p className="mx-auto max-w-2xl text-zinc-400">Powerful features designed for professionals who value their time.</p>
          </div>
          
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<Mail className="h-5 w-5" />}
              title="Smart Classification"
              description="AI categorizes emails into actionable buckets: respond, calendar, FYI, and more. Never miss what matters."
            />
            <FeatureCard
              icon={<MessageSquare className="h-5 w-5" />}
              title="AI-Drafted Responses"
              description="Get intelligent reply suggestions that match your tone and style. Edit and send in seconds."
            />
            <FeatureCard
              icon={<Calendar className="h-5 w-5" />}
              title="Calendar Integration"
              description="Automatically detect meeting requests and book them with your availability. No back-and-forth."
            />
            <FeatureCard
              icon={<Clock className="h-5 w-5" />}
              title="Daily Digests"
              description="Start each day with a summary of what needs attention. Prioritize what matters most."
            />
            <FeatureCard
              icon={<TrendingUp className="h-5 w-5" />}
              title="Analytics Dashboard"
              description="Track your email patterns, response times, and productivity gains over time."
            />
            <FeatureCard
              icon={<Zap className="h-5 w-5" />}
              title="Instant Processing"
              description="Process hundreds of emails in seconds. Powered by advanced AI that learns your preferences."
            />
          </div>
        </div>
      </section>

      {/* Declutter Section */}
      <section className="border-t border-white/10 py-20 overflow-hidden">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium uppercase tracking-wider text-orange-400">Inbox Zero</p>
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Thousands of unread emails?</h2>
              <p className="mb-6 text-lg text-zinc-400">
                Years of newsletters, promotions, and forgotten threads clogging your inbox? Zeno cuts through the noise.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/20 text-orange-400">
                    <Check className="h-4 w-4" />
                  </div>
                  <span className="text-zinc-300">Finds important emails buried in the chaos</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/20 text-orange-400">
                    <Check className="h-4 w-4" />
                  </div>
                  <span className="text-zinc-300">Mass-archive newsletters and promotions</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/20 text-orange-400">
                    <Check className="h-4 w-4" />
                  </div>
                  <span className="text-zinc-300">Declutter 10,000+ emails in minutes</span>
                </li>
              </ul>
              <Link
                href="/login"
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-3 font-medium text-white transition-all hover:bg-orange-600"
              >
                Declutter My Inbox
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            
            {/* Declutter Graphic */}
            <div className="relative">
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-orange-500/20 blur-[100px]" />
              <div className="relative rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-transparent p-6">
                {/* Inbox visualization */}
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm font-medium text-orange-400">Before Zeno</span>
                  <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400">12,847 unread</span>
                </div>
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg bg-white/5 p-3 opacity-60">
                      <div className="h-8 w-8 rounded-full bg-zinc-700" />
                      <div className="flex-1">
                        <div className="h-3 w-3/4 rounded bg-zinc-700" />
                        <div className="mt-1 h-2 w-1/2 rounded bg-zinc-800" />
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="my-4 flex items-center gap-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />
                  <Sparkles className="h-5 w-5 text-orange-400" />
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />
                </div>
                
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm font-medium text-emerald-400">After Zeno</span>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">24 important</span>
                </div>
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg bg-white/10 p-3 ring-1 ring-emerald-500/30">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400" />
                      <div className="flex-1">
                        <div className="h-3 w-3/4 rounded bg-zinc-600" />
                        <div className="mt-1 h-2 w-1/2 rounded bg-zinc-700" />
                      </div>
                      <div className="rounded bg-red-500/20 px-2 py-0.5 text-xs text-red-400">Reply</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="border-t border-white/10 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium uppercase tracking-wider text-emerald-400">Security First</p>
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Your data stays yours</h2>
              <p className="mb-8 text-zinc-400">
                We take security seriously. Your emails are processed securely and never used to train AI models. You stay in control.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                    <Lock className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">End-to-End Encryption</h3>
                    <p className="text-sm text-zinc-400">All data encrypted in transit and at rest using industry-standard protocols.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                    <Eye className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">No AI Training on Your Data</h3>
                    <p className="text-sm text-zinc-400">Your emails are never used to train models. Period.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">SOC 2 Compliant</h3>
                    <p className="text-sm text-zinc-400">Enterprise-grade security controls and regular audits.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8">
              <div className="mb-6 flex items-center gap-3">
                <Shield className="h-8 w-8 text-emerald-400" />
                <span className="text-xl font-bold">Privacy Promise</span>
              </div>
              <ul className="space-y-3">
                {["Emails processed in secure environment", "Data deleted on account closure", "No selling to third parties", "GDPR & CCPA compliant", "Transparent data practices"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-zinc-300">
                    <Check className="h-4 w-4 text-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-t border-white/10 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-2 text-sm font-medium uppercase tracking-wider text-blue-400">Testimonials</p>
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Loved by professionals</h2>
          </div>
          
          <div className="grid gap-6 md:grid-cols-3">
            <TestimonialCard
              quote="Zeno's Email Agent is a gamechanger to start my day. My inbox is finally under control."
              author="Sarah K."
              role="Product Manager"
            />
            <TestimonialCard
              quote="I was skeptical about AI email tools, but Zeno actually gets it right. The draft quality is impressive."
              author="Michael R."
              role="Startup Founder"
            />
            <TestimonialCard
              quote="Saves me at least 2 hours every week. The calendar integration alone is worth it."
              author="Jennifer L."
              role="Sales Director"
            />
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="border-t border-white/10 py-20">
        <div className="mx-auto max-w-3xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-2 text-sm font-medium uppercase tracking-wider text-blue-400">FAQ</p>
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Common questions</h2>
          </div>
          
          <div className="space-y-4">
            <FAQItem 
              question="How does Zeno access my emails?"
              answer="Zeno uses Google's secure OAuth system. We never see your password. You can revoke access anytime from your Google account settings."
            />
            <FAQItem 
              question="Will Zeno send emails without my permission?"
              answer="Never. Zeno drafts responses for your review, but you always have final approval before anything is sent."
            />
            <FAQItem 
              question="Is my data used to train AI?"
              answer="No. Your emails are processed to provide you with the service, but they are never used to train AI models or shared with third parties."
            />
            <FAQItem 
              question="What happens if I cancel?"
              answer="You can export your data anytime. Upon cancellation, all your data is permanently deleted within 30 days."
            />
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
            href="/login"
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
              className="h-8 w-auto opacity-60"
            />
            <div className="flex items-center gap-6 text-sm text-zinc-500">
              <Link href="/terms" className="transition-colors hover:text-white">
                Terms of Service
              </Link>
              <Link href="/privacy" className="transition-colors hover:text-white">
                Privacy Policy
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

function TestimonialCard({
  quote,
  author,
  role,
}: {
  quote: string;
  author: string;
  role: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6">
      <div className="mb-4 flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
        ))}
      </div>
      <p className="mb-4 text-zinc-300">&ldquo;{quote}&rdquo;</p>
      <div>
        <p className="font-medium">{author}</p>
        <p className="text-sm text-zinc-500">{role}</p>
      </div>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="rounded-xl border border-white/10 bg-white/5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <span className="font-medium">{question}</span>
        <ChevronDown className={`h-5 w-5 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="border-t border-white/10 px-4 py-3 text-sm text-zinc-400">
          {answer}
        </div>
      )}
    </div>
  );
}
