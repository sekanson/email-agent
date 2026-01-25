"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl px-6 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
          Privacy Policy
        </h1>
        <p className="text-[var(--text-muted)] mb-12">Last updated: January 25, 2026</p>

        <div className="prose prose-invert prose-zinc max-w-none">
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">1. Introduction</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              xix3D Inc. ("Company," "we," "us," or "our") operates Zeno Email Agent ("Service").
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service.
            </p>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              By using the Service, you consent to the data practices described in this policy.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">2. Information We Collect</h2>

            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              <strong className="text-[var(--text-primary)]">Account Information:</strong>
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 ml-4 mb-4">
              <li>Name (from Google account)</li>
              <li>Email address (from Google account)</li>
              <li>Profile picture (from Google account)</li>
            </ul>

            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              <strong className="text-[var(--text-primary)]">Email Data:</strong>
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 ml-4 mb-4">
              <li>Email metadata (sender, recipient, subject, date)</li>
              <li>Email content (for AI classification and draft generation)</li>
              <li>Email labels and categories</li>
            </ul>

            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              <strong className="text-[var(--text-primary)]">Usage Data:</strong>
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 ml-4 mb-4">
              <li>Features used and frequency</li>
              <li>Email processing statistics</li>
              <li>Draft creation counts</li>
              <li>Log data (IP address, browser type, access times)</li>
            </ul>

            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              <strong className="text-[var(--text-primary)]">Payment Information:</strong>
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 ml-4">
              <li>Processed securely by Stripe</li>
              <li>We do not store credit card numbers</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">3. How We Use Your Information</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              We use your information to:
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 ml-4">
              <li>Provide, operate, and maintain the Service</li>
              <li>Process and categorize your emails using AI</li>
              <li>Generate draft responses to emails</li>
              <li>Apply labels to your Gmail account</li>
              <li>Improve and personalize the Service</li>
              <li>Process payments and manage subscriptions</li>
              <li>Send service-related communications</li>
              <li>Detect and prevent fraud or abuse</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">4. AI Processing</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              Your email content is processed by Anthropic's Claude AI for:
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 ml-4 mb-4">
              <li>Email classification and categorization</li>
              <li>Draft response generation</li>
              <li>Analyzing writing style (if enabled)</li>
            </ul>
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4 mt-4">
              <p className="text-[var(--text-secondary)] leading-relaxed">
                <strong className="text-[var(--text-primary)]">Important:</strong>
              </p>
              <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 ml-4 mt-2">
                <li>Email content is processed in real-time and not stored permanently</li>
                <li>We do not use your emails to train AI models</li>
                <li>AI processing is solely for providing the Service to you</li>
              </ul>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">5. Google API Disclosure</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              Zeno Email Agent's use and transfer of information received from Google APIs to any other app adheres to
              Google API Services User Data Policy, including the Limited Use requirements.
            </p>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              We only access Gmail data necessary to:
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 ml-4 mb-4">
              <li>Read incoming emails for classification</li>
              <li>Apply labels to categorized emails</li>
              <li>Create draft responses</li>
              <li>Access sent emails for writing style analysis (if enabled)</li>
            </ul>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              You can revoke access at any time through your{" "}
              <a href="https://myaccount.google.com/permissions" className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">
                Google Account settings
              </a>.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">6. Data Sharing and Disclosure</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              <strong className="text-[var(--text-primary)]">We do NOT:</strong>
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 ml-4 mb-4">
              <li>Sell your personal information</li>
              <li>Share email content with advertisers</li>
              <li>Use your data for targeted advertising</li>
              <li>Share your data with third parties for their marketing</li>
            </ul>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              <strong className="text-[var(--text-primary)]">We DO share data with:</strong>
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 ml-4 mb-4">
              <li>Anthropic (AI processing) - email content for classification</li>
              <li>Stripe (payments) - payment information only</li>
              <li>Supabase (database) - account and metadata storage</li>
              <li>Vercel (hosting) - application hosting</li>
            </ul>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              We may also disclose information:
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 ml-4">
              <li>To comply with legal obligations</li>
              <li>To protect our rights and safety</li>
              <li>With your consent</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">7. Data Storage and Security</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              Your data is stored securely using:
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 ml-4 mb-4">
              <li>Supabase (PostgreSQL database) with encryption at rest</li>
              <li>Secure HTTPS connections for all data transmission</li>
              <li>OAuth 2.0 for Google authentication (we never see your Google password)</li>
              <li>Environment variables for API keys and secrets</li>
            </ul>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              We implement industry-standard security measures, but no method of transmission over the Internet is 100% secure.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">8. Data Retention</h2>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 ml-4 mb-4">
              <li><strong className="text-[var(--text-primary)]">Account data:</strong> Retained until you delete your account</li>
              <li><strong className="text-[var(--text-primary)]">Email metadata:</strong> Retained for analytics and history</li>
              <li><strong className="text-[var(--text-primary)]">Email content:</strong> Processed in real-time, not stored permanently</li>
              <li><strong className="text-[var(--text-primary)]">Payment records:</strong> Retained as required by law</li>
            </ul>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Upon account deletion, we will delete your personal data within 30 days, except where retention is required by law.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">9. Your Rights</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              Depending on your location, you may have the right to:
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 ml-4 mb-4">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Delete your data ("right to be forgotten")</li>
              <li>Export your data (data portability)</li>
              <li>Opt out of certain processing</li>
              <li>Withdraw consent</li>
            </ul>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              To exercise these rights, contact us at{" "}
              <a href="mailto:support@xix3d.com" className="text-blue-400 hover:underline">support@xix3d.com</a>.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">10. California Privacy Rights (CCPA)</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              California residents have additional rights:
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 ml-4 mb-4">
              <li>Right to know what personal information is collected</li>
              <li>Right to know if personal information is sold or disclosed</li>
              <li>Right to say no to the sale of personal information</li>
              <li>Right to delete personal information</li>
              <li>Right to non-discrimination</li>
            </ul>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              We do not sell personal information as defined by CCPA.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">11. European Privacy Rights (GDPR)</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              If you are in the European Economic Area, you have rights under GDPR including:
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 ml-4 mb-4">
              <li>Right of access</li>
              <li>Right to rectification</li>
              <li>Right to erasure</li>
              <li>Right to restrict processing</li>
              <li>Right to data portability</li>
              <li>Right to object</li>
              <li>Rights related to automated decision-making</li>
            </ul>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              Our legal basis for processing is:
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 ml-4">
              <li>Contract performance (providing the Service)</li>
              <li>Legitimate interests (improving the Service)</li>
              <li>Consent (where specifically requested)</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">12. Cookies and Tracking</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              We use essential cookies for:
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 ml-4 mb-4">
              <li>Authentication and session management</li>
              <li>User preferences (e.g., dark mode)</li>
            </ul>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              We do not use:
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 ml-4">
              <li>Advertising cookies</li>
              <li>Third-party tracking cookies</li>
              <li>Cross-site tracking</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">13. Children's Privacy</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              The Service is not intended for users under 18 years of age. We do not knowingly collect information from children.
              If we learn we have collected data from a child, we will delete it promptly.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">14. International Data Transfers</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Your data may be processed in countries other than your own, including Canada and the United States.
              We ensure appropriate safeguards are in place for international transfers.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">15. Changes to This Policy</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of material changes via email or in-app notification.
              The "Last updated" date will be revised accordingly.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">16. Contact Us</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              For privacy questions or to exercise your rights:
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 ml-4 mb-4">
              <li>Email: <a href="mailto:support@xix3d.com" className="text-blue-400 hover:underline">support@xix3d.com</a></li>
              <li>Website: <a href="https://xix3d.com" className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">xix3d.com</a></li>
            </ul>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              For privacy complaints, you may also contact your local data protection authority.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-8 text-center text-sm text-[var(--text-muted)]">
        <div className="flex justify-center gap-4">
          <Link href="/terms" className="hover:text-[var(--text-primary)] transition-colors">Terms of Service</Link>
          <span>•</span>
          <Link href="/privacy" className="hover:text-[var(--text-primary)] transition-colors">Privacy Policy</Link>
          <span>•</span>
          <a href="mailto:support@xix3d.com" className="hover:text-[var(--text-primary)] transition-colors">Contact</a>
        </div>
        <p className="mt-4">&copy; 2026 xix3D Inc. All rights reserved.</p>
      </footer>
    </div>
  );
}
