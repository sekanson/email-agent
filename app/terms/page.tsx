"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="text-[var(--text-muted)] mb-12">Last updated: January 25, 2026</p>

        <div className="prose prose-invert prose-zinc max-w-none">
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">1. Introduction</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Welcome to Zeno Email Agent ("Service"), operated by xix3D Inc. ("Company," "we," "us," or "our").
              By accessing or using our Service at zenoemail.xix3d.com, you agree to be bound by these Terms of Service ("Terms").
              If you do not agree to these Terms, please do not use the Service.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">2. Description of Service</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              Zeno Email Agent is an AI-powered email management tool that:
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 ml-4">
              <li>Connects to your Gmail account via secure OAuth authentication</li>
              <li>Automatically categorizes and labels incoming emails using artificial intelligence</li>
              <li>Generates draft responses for emails requiring replies</li>
              <li>Provides analytics and insights about your email activity</li>
            </ul>
            <p className="text-[var(--text-secondary)] leading-relaxed mt-4">
              The Service uses third-party artificial intelligence (Anthropic's Claude) to process and analyze email content
              for classification and draft generation purposes.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">3. Eligibility</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              You must be at least 18 years old and capable of forming a binding contract to use this Service.
              By using the Service, you represent and warrant that you meet these requirements.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">4. Account Registration</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              To use the Service, you must:
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 ml-4">
              <li>Sign in using a valid Google account</li>
              <li>Grant necessary permissions for Gmail access</li>
              <li>Provide accurate and complete information</li>
              <li>Maintain the security of your account credentials</li>
            </ul>
            <p className="text-[var(--text-secondary)] leading-relaxed mt-4">
              You are responsible for all activities that occur under your account.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">5. Google API Services</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              Our use of information received from Google APIs adheres to the Google API Services User Data Policy,
              including the Limited Use requirements. Specifically:
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 ml-4">
              <li>We only request access to data necessary to provide the Service</li>
              <li>We do not use Google user data for advertising purposes</li>
              <li>We do not sell Google user data to third parties</li>
              <li>We only use Google user data to provide and improve the Service</li>
              <li>We allow users to revoke access at any time</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">6. Acceptable Use</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              You agree NOT to:
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 ml-4">
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to any systems or networks</li>
              <li>Transmit spam, malware, or other harmful content</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Reverse engineer or attempt to extract source code</li>
              <li>Use the Service to violate any third party's rights</li>
              <li>Share account credentials with others</li>
              <li>Use automated systems to access the Service without permission</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">7. Subscription and Payment</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              <strong className="text-[var(--text-primary)]">Free Tier:</strong>
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 ml-4 mb-4">
              <li>Limited to 10 AI-generated drafts</li>
              <li>Basic email categorization features</li>
            </ul>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              <strong className="text-[var(--text-primary)]">Pro Subscription:</strong>
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 ml-4 mb-4">
              <li>Unlimited AI-generated drafts</li>
              <li>Priority processing</li>
              <li>Advanced features</li>
            </ul>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Payment is processed securely through Stripe. Subscriptions renew automatically unless cancelled.
              You may cancel at any time through your account settings. Refunds are provided at our discretion.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">8. Intellectual Property</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              The Service, including its original content, features, and functionality, is owned by xix3D Inc.
              and protected by international copyright, trademark, and other intellectual property laws.
            </p>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              You retain all rights to your email content. By using the Service, you grant us a limited license
              to process your email content solely for providing the Service.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">9. AI-Generated Content</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Draft responses generated by the Service are suggestions only. You are solely responsible for reviewing,
              editing, and sending any communications. We do not guarantee the accuracy, appropriateness, or quality
              of AI-generated content.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">10. Privacy</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Your use of the Service is also governed by our{" "}
              <Link href="/privacy" className="text-blue-400 hover:underline">Privacy Policy</Link>,
              which is incorporated into these Terms by reference.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">11. Disclaimer of Warranties</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4 uppercase text-sm">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
              INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              We do not warrant that:
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 ml-4">
              <li>The Service will be uninterrupted or error-free</li>
              <li>Defects will be corrected</li>
              <li>The Service is free of viruses or harmful components</li>
              <li>AI classifications or drafts will be accurate</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">12. Limitation of Liability</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4 uppercase text-sm">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, xix3D INC. SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
              CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, OR GOODWILL,
              ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE.
            </p>
            <p className="text-[var(--text-secondary)] leading-relaxed uppercase text-sm">
              OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT PAID BY YOU TO US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">13. Indemnification</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              You agree to indemnify, defend, and hold harmless xix3D Inc. and its officers, directors, employees,
              and agents from any claims, damages, losses, or expenses arising from your use of the Service or violation of these Terms.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">14. Termination</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              We may terminate or suspend your access immediately, without prior notice, for any reason,
              including breach of these Terms. Upon termination, your right to use the Service ceases immediately.
            </p>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              You may terminate your account at any time by discontinuing use and revoking Gmail access through your Google account settings.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">15. Changes to Terms</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              We reserve the right to modify these Terms at any time. We will notify users of material changes via email
              or in-app notification. Continued use after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">16. Governing Law</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              These Terms shall be governed by the laws of the Province of Ontario, Canada, without regard to conflict of law principles.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">17. Dispute Resolution</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Any disputes arising from these Terms or the Service shall first be attempted to be resolved through informal negotiation.
              If unresolved, disputes shall be submitted to binding arbitration in Ontario, Canada.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">18. Severability</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              If any provision of these Terms is found unenforceable, the remaining provisions shall continue in effect.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">19. Contact Us</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              For questions about these Terms, contact us at:
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 ml-4">
              <li>Email: <a href="mailto:support@xix3d.com" className="text-blue-400 hover:underline">support@xix3d.com</a></li>
              <li>Website: <a href="https://xix3d.com" className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">xix3d.com</a></li>
            </ul>
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
