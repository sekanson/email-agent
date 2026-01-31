"use client";

import { useState, TouchEvent } from "react";
import {
  Sparkles,
  Tag,
  Zap,
  PenLine,
  Check,
  ArrowRight,
  Loader2,
  X,
  Inbox,
  Mail,
  ChevronLeft,
} from "lucide-react";

interface OnboardingModalProps {
  userEmail: string;
  userName: string;
  onComplete: () => void;
  onSkip: () => void;
}

type Step = "welcome" | "labels" | "agent" | "style" | "declutter" | "done";

export default function OnboardingModal({
  userEmail,
  userName,
  onComplete,
  onSkip,
}: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState<Step>("welcome");
  const [labelsLoading, setLabelsLoading] = useState(false);
  const [labelsCreated, setLabelsCreated] = useState(false);
  const [agentEnabled, setAgentEnabled] = useState(false);
  const [styleLoading, setStyleLoading] = useState(false);
  const [styleAnalyzed, setStyleAnalyzed] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const steps: Step[] = ["welcome", "labels", "agent", "style", "declutter", "done"];
  const currentIndex = steps.indexOf(currentStep);

  // Swipe handling for mobile
  const minSwipeDistance = 50;

  function onTouchStart(e: TouchEvent) {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  }

  function onTouchMove(e: TouchEvent) {
    setTouchEnd(e.targetTouches[0].clientX);
  }

  function onTouchEnd() {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    // Only allow swiping between steps if not in loading state
    if (labelsLoading || styleLoading) return;

    if (isLeftSwipe && currentIndex < steps.length - 1) {
      // Swipe left = go to next step (only if allowed)
      handleSwipeNext();
    } else if (isRightSwipe && currentIndex > 0) {
      // Swipe right = go to previous step
      handleSwipePrev();
    }
  }

  function handleSwipeNext() {
    // Define which steps can be freely navigated to via swipe
    if (currentStep === "welcome") setCurrentStep("labels");
    else if (currentStep === "labels") setCurrentStep("agent");
    else if (currentStep === "agent") setCurrentStep("style");
    else if (currentStep === "style") setCurrentStep("declutter");
    else if (currentStep === "declutter") setCurrentStep("done");
  }

  function handleSwipePrev() {
    if (currentStep === "labels") setCurrentStep("welcome");
    else if (currentStep === "agent") setCurrentStep("labels");
    else if (currentStep === "style") setCurrentStep("agent");
    else if (currentStep === "declutter") setCurrentStep("style");
    else if (currentStep === "done") setCurrentStep("declutter");
  }

  async function handleSetupLabels() {
    setLabelsLoading(true);
    try {
      const res = await fetch("/api/setup-labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail }),
      });

      if (res.ok) {
        setLabelsCreated(true);
        setTimeout(() => setCurrentStep("agent"), 500);
      } else {
        console.error("Failed to create labels");
      }
    } catch (error) {
      console.error("Error creating labels:", error);
    } finally {
      setLabelsLoading(false);
    }
  }

  function handleToggleAgent() {
    setAgentEnabled(!agentEnabled);
    localStorage.setItem("agentEnabled", (!agentEnabled).toString());
  }

  async function handleAnalyzeStyle() {
    setStyleLoading(true);
    try {
      const res = await fetch("/api/analyze-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail }),
      });

      if (res.ok) {
        setStyleAnalyzed(true);
        setTimeout(() => setCurrentStep("declutter"), 500);
      }
    } catch (error) {
      console.error("Error analyzing style:", error);
    } finally {
      setStyleLoading(false);
    }
  }

  function handleSkipStyle() {
    setCurrentStep("declutter");
  }

  function handleDeclutterNow() {
    // Save onboarding as complete and redirect to declutter
    handleFinish("/declutter");
  }

  function handleSkipDeclutter() {
    setCurrentStep("done");
  }

  async function handleFinish(redirectTo: string = "/dashboard") {
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail,
          onboarding_completed: true,
        }),
      });
    } catch (error) {
      console.error("Error saving onboarding status:", error);
    }

    if (redirectTo === "/declutter") {
      window.location.href = "/declutter";
    } else {
      onComplete();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="relative flex h-full w-full flex-col bg-[var(--bg-primary)] sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl sm:border sm:border-[var(--border)] sm:shadow-2xl">
        {/* Mobile header with back button */}
        <div className="flex min-h-[56px] items-center justify-between border-b border-[var(--border)] px-4 sm:hidden">
          {currentIndex > 0 && currentStep !== "done" ? (
            <button
              onClick={handleSwipePrev}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-elevated)]"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          ) : (
            <div className="w-11" />
          )}
          <span className="text-sm font-medium text-[var(--text-muted)]">
            Step {currentIndex + 1} of {steps.length}
          </span>
          {currentStep !== "done" ? (
            <button
              onClick={onSkip}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-elevated)]"
            >
              <X className="h-5 w-5" />
            </button>
          ) : (
            <div className="w-11" />
          )}
        </div>

        {/* Desktop skip button */}
        {currentStep !== "done" && (
          <button
            onClick={onSkip}
            className="absolute right-4 top-4 hidden rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] sm:block"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto px-6 py-8 sm:px-8">
          {/* Progress dots */}
          <div className="mb-8 flex justify-center gap-2">
            {steps.map((step, index) => (
              <div
                key={step}
                className={`h-2 w-2 rounded-full transition-colors ${
                  index <= currentIndex
                    ? "bg-[var(--accent)]"
                    : "bg-[var(--border)]"
                }`}
              />
            ))}
          </div>

          {/* Step: Welcome */}
          {currentStep === "welcome" && (
            <div className="flex flex-col text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 sm:h-16 sm:w-16">
                <Sparkles className="h-10 w-10 text-white sm:h-8 sm:w-8" />
              </div>
              <h2 className="text-2xl font-bold text-[var(--text-primary)] sm:text-2xl">
                Welcome to Zeno, {userName?.split(" ")[0] || "there"}!
              </h2>
              <p className="mt-4 text-base text-[var(--text-secondary)] sm:text-base">
                Let&apos;s set up your AI email assistant in just a few minutes.
                You&apos;ll have an organized inbox before you know it.
              </p>
              <button
                onClick={() => setCurrentStep("labels")}
                className="mt-8 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-4 text-base font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] sm:min-h-0 sm:py-3"
              >
                Let&apos;s Get Started
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          )}

          {/* Step: Create Labels */}
          {currentStep === "labels" && (
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-purple-500/10 sm:h-16 sm:w-16">
                <Tag className="h-10 w-10 text-purple-500 sm:h-8 sm:w-8" />
              </div>
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                Smart Categories
              </h2>
              <p className="mt-4 text-base text-[var(--text-secondary)]">
                Zeno organizes your emails into 8 smart categories:
              </p>
              <div className="mt-6 grid grid-cols-2 gap-2 text-left text-sm sm:gap-2">
                {[
                  { name: "Action Required", color: "bg-red-400" },
                  { name: "FYI Only", color: "bg-amber-400" },
                  { name: "Team Updates", color: "bg-cyan-400" },
                  { name: "Notifications", color: "bg-emerald-400" },
                  { name: "Meetings & Events", color: "bg-purple-400" },
                  { name: "Waiting for Reply", color: "bg-blue-400" },
                  { name: "Completed", color: "bg-teal-400" },
                  { name: "Marketing & Spam", color: "bg-pink-400" },
                ].map((cat) => (
                  <div
                    key={cat.name}
                    className="flex min-h-[44px] items-center gap-2 rounded-lg bg-[var(--bg-card)] p-3 sm:min-h-0 sm:p-2"
                  >
                    <div className={`h-3 w-3 rounded-full sm:h-2.5 sm:w-2.5 ${cat.color}`} />
                    <span className="text-base text-[var(--text-primary)] sm:text-sm">{cat.name}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm text-[var(--text-muted)]">
                These are smart defaults — you can customize them anytime in Settings.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => setCurrentStep("agent")}
                  className="min-h-[52px] flex-1 rounded-xl border border-[var(--border)] py-4 text-base font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] sm:min-h-0 sm:py-3"
                >
                  Skip for later
                </button>
                <button
                  onClick={handleSetupLabels}
                  disabled={labelsLoading || labelsCreated}
                  className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-4 text-base font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50 sm:min-h-0 sm:py-3"
                >
                  {labelsLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Creating Labels...
                    </>
                  ) : labelsCreated ? (
                    <>
                      <Check className="h-5 w-5" />
                      Labels Created!
                    </>
                  ) : (
                    <>
                      <Tag className="h-5 w-5" />
                      Setup Labels
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step: Enable Agent */}
          {currentStep === "agent" && (
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500/10 sm:h-16 sm:w-16">
                <Zap className="h-10 w-10 text-emerald-500 sm:h-8 sm:w-8" />
              </div>
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                Auto-Processing
              </h2>
              <p className="mt-4 text-base text-[var(--text-secondary)]">
                When enabled, Zeno will automatically categorize new emails as they
                arrive. You can always run manual processing from the dashboard.
              </p>
              <div className="mt-8 flex items-center justify-center gap-4">
                <span
                  className={`text-base sm:text-sm ${
                    !agentEnabled
                      ? "text-[var(--text-primary)]"
                      : "text-[var(--text-muted)]"
                  }`}
                >
                  Manual
                </span>
                <button
                  onClick={handleToggleAgent}
                  className={`relative h-10 w-20 rounded-full transition-colors sm:h-7 sm:w-14 ${
                    agentEnabled ? "bg-emerald-500" : "bg-[var(--border)]"
                  }`}
                >
                  <div
                    className={`absolute top-1 h-8 w-8 rounded-full bg-white shadow-md transition-transform sm:top-0.5 sm:h-6 sm:w-6 ${
                      agentEnabled ? "translate-x-10 sm:translate-x-7" : "translate-x-1 sm:translate-x-0.5"
                    }`}
                  />
                </button>
                <span
                  className={`text-base sm:text-sm ${
                    agentEnabled
                      ? "text-[var(--text-primary)]"
                      : "text-[var(--text-muted)]"
                  }`}
                >
                  Auto
                </span>
              </div>
              <p className="mt-4 text-sm text-[var(--text-muted)]">
                {agentEnabled
                  ? "New emails will be categorized automatically."
                  : "You'll need to manually trigger email processing."}
              </p>
              <button
                onClick={() => setCurrentStep("style")}
                className="mt-8 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-4 text-base font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] sm:min-h-0 sm:py-3"
              >
                Continue
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          )}

          {/* Step: Writing Style */}
          {currentStep === "style" && (
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-500/10 sm:h-16 sm:w-16">
                <PenLine className="h-10 w-10 text-amber-500 sm:h-8 sm:w-8" />
              </div>
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                Your Writing Style
              </h2>
              <p className="mt-4 text-base text-[var(--text-secondary)]">
                Want AI drafts that sound like you? Zeno can analyze your sent
                emails to learn your unique voice and tone.
              </p>
              <p className="mt-4 text-sm text-[var(--text-muted)]">
                This analyzes your last 50 sent emails to understand your style.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={handleSkipStyle}
                  className="min-h-[52px] flex-1 rounded-xl border border-[var(--border)] py-4 text-base font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] sm:min-h-0 sm:py-3"
                >
                  Skip for now
                </button>
                <button
                  onClick={handleAnalyzeStyle}
                  disabled={styleLoading || styleAnalyzed}
                  className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-4 text-base font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50 sm:min-h-0 sm:py-3"
                >
                  {styleLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Analyzing...
                    </>
                  ) : styleAnalyzed ? (
                    <>
                      <Check className="h-5 w-5" />
                      Done!
                    </>
                  ) : (
                    <>
                      <PenLine className="h-5 w-5" />
                      Analyze Style
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step: Declutter */}
          {currentStep === "declutter" && (
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/20 sm:h-16 sm:w-16">
                <Inbox className="h-10 w-10 text-orange-500 sm:h-8 sm:w-8" />
              </div>
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                Inbox Overflowing?
              </h2>
              <p className="mt-4 text-base text-[var(--text-secondary)]">
                Have an unmanageable inbox? Too many unread emails piling up?
                Zeno can help you get to inbox zero fast.
              </p>

              <div className="mt-6 rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
                <div className="flex items-start gap-3 text-left">
                  <Mail className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-400" />
                  <div>
                    <p className="text-base font-medium text-[var(--text-primary)]">
                      Declutter scans your unread emails and:
                    </p>
                    <ul className="mt-2 space-y-2 text-sm text-[var(--text-secondary)] sm:space-y-1">
                      <li>Finds important emails that need attention</li>
                      <li>Identifies receipts, subscriptions, marketing</li>
                      <li>Lets you mass-clear the noise with one click</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={handleSkipDeclutter}
                  className="min-h-[52px] flex-1 rounded-xl border border-[var(--border)] py-4 text-base font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] sm:min-h-0 sm:py-3"
                >
                  Maybe later
                </button>
                <button
                  onClick={handleDeclutterNow}
                  className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 py-4 text-base font-semibold text-white shadow-lg shadow-orange-500/25 transition-all hover:from-orange-400 hover:to-red-400 sm:min-h-0 sm:py-3"
                >
                  <Inbox className="h-5 w-5" />
                  Declutter Now
                </button>
              </div>
            </div>
          )}

          {/* Step: Done */}
          {currentStep === "done" && (
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 sm:h-16 sm:w-16">
                <Check className="h-10 w-10 text-white sm:h-8 sm:w-8" />
              </div>
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                You&apos;re all set!
              </h2>
              <p className="mt-4 text-base text-[var(--text-secondary)]">
                Your AI email assistant is ready to help you conquer your inbox.
              </p>
              <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                <p className="text-sm text-[var(--text-muted)]">What you can do:</p>
                <ul className="mt-3 space-y-3 text-left text-base text-[var(--text-secondary)] sm:mt-2 sm:space-y-2 sm:text-sm">
                  <li className="flex items-center gap-3 sm:gap-2">
                    <Check className="h-5 w-5 flex-shrink-0 text-emerald-500 sm:h-4 sm:w-4" />
                    Process emails to categorize them automatically
                  </li>
                  <li className="flex items-center gap-3 sm:gap-2">
                    <Check className="h-5 w-5 flex-shrink-0 text-emerald-500 sm:h-4 sm:w-4" />
                    Review AI-generated draft responses
                  </li>
                  <li className="flex items-center gap-3 sm:gap-2">
                    <Check className="h-5 w-5 flex-shrink-0 text-emerald-500 sm:h-4 sm:w-4" />
                    Use Declutter to clear inbox backlog anytime
                  </li>
                </ul>
              </div>
              <button
                onClick={() => handleFinish()}
                className="mt-8 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:from-emerald-400 hover:to-teal-400 sm:min-h-0 sm:py-3"
              >
                Go to Dashboard
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>

        {/* Mobile swipe hint */}
        <div className="border-t border-[var(--border)] px-6 py-3 text-center sm:hidden">
          <p className="text-xs text-[var(--text-muted)]">
            Swipe left or right to navigate
          </p>
        </div>
      </div>
    </div>
  );
}
