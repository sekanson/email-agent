# Zeno Email Agent - Comprehensive Test Protocol

**Tester:** Mirmi (mirmi@xix3d.com)
**App URL:** https://zenoemail.xix3d.com
**Date:** 2026-01-30

---

## Test Categories

### 1. Authentication & Onboarding
| Test | Expected | Status | Notes |
|------|----------|--------|-------|
| Landing page loads | Shows marketing page with "Get Started" | ⬜ | |
| Google OAuth login | Redirects to Google, returns to app | ⬜ | |
| Gmail permission grant | App can read/send emails | ⬜ | |
| Onboarding modal appears | First-time users see setup wizard | ⬜ | |
| Onboarding skip works | Can skip and access dashboard | ⬜ | |

### 2. Dashboard (/dashboard)
| Test | Expected | Status | Notes |
|------|----------|--------|-------|
| Dashboard loads | Shows metrics, recent emails | ⬜ | |
| Email metrics display | Shows processed count, categories | ⬜ | |
| "Scan & Classify" button | Processes unread emails | ⬜ | |
| Email list displays | Shows recent processed emails | ⬜ | |
| Category badges work | Correct colors, click filters | ⬜ | |
| Reset Metrics confirm modal | Custom modal (not browser) | ⬜ | |
| Reset Metrics executes | Clears history, resets to zero | ⬜ | |
| Upgrade prompt (if applicable) | Shows v2 category upgrade | ⬜ | |

### 3. Categorize (/categorize)
| Test | Expected | Status | Notes |
|------|----------|--------|-------|
| Page loads | Shows 8 default categories | ⬜ | |
| Category name edit | Can rename categories | ⬜ | |
| Category color picker | Gmail-compatible colors only | ⬜ | |
| Category description edit | Can update description | ⬜ | |
| Category rules edit | Can update rules | ⬜ | |
| Add category (if <8) | Adds new category | ⬜ | |
| Delete category | Removes category, shows "Other" | ⬜ | |
| Restore Defaults modal | Custom modal appears | ⬜ | |
| Restore Defaults executes | Resets to 8 defaults | ⬜ | |
| Save & Sync to Gmail | Creates/updates Gmail labels | ⬜ | |
| Start Fresh modal | Custom danger modal appears | ⬜ | |
| Start Fresh executes | Deletes ALL Gmail labels | ⬜ | |
| Category upgrade prompt | Shows if on v1, offers v2 | ⬜ | |

### 4. Drafts (/drafts)
| Test | Expected | Status | Notes |
|------|----------|--------|-------|
| Page loads | Shows draft settings | ⬜ | |
| Temperature slider | Adjusts AI creativity | ⬜ | |
| Writing style display | Shows analyzed style | ⬜ | |
| "Analyze My Style" button | Scans sent emails, generates style | ⬜ | |
| Signature editor | Can edit HTML signature | ⬜ | |
| Signature preview | Shows rendered signature | ⬜ | |
| Enable/disable drafts toggle | Turns auto-drafts on/off | ⬜ | |
| Reset to Defaults modal | Custom modal appears | ⬜ | |
| Save settings | Persists changes | ⬜ | |

### 5. Declutter (/declutter)
| Test | Expected | Status | Notes |
|------|----------|--------|-------|
| Page loads | Shows scan interface | ⬜ | |
| Scan emails button | Scans inbox for clutter | ⬜ | |
| Results display | Shows categorized emails | ⬜ | |
| Select individual emails | Checkbox selection works | ⬜ | |
| Select all | Selects all in category | ⬜ | |
| Bulk unsubscribe modal | Custom modal appears | ⬜ | |
| Bulk unsubscribe executes | Opens unsubscribe tabs | ⬜ | |
| Mark as read | Marks selected as read | ⬜ | |
| Archive/delete actions | Moves emails appropriately | ⬜ | |
| Sender blocking | Blocks selected senders | ⬜ | |

### 6. Assistant (/assistant) - Zeno AI
| Test | Expected | Status | Notes |
|------|----------|--------|-------|
| Page loads | Shows Zeno assistant interface | ⬜ | |
| Digest settings | Can configure digest times | ⬜ | |
| VIP senders list | Can add/remove VIP senders | ⬜ | |
| Focus Mode toggle | Can enable/disable | ⬜ | |
| Focus Mode timer | Shows countdown if active | ⬜ | |
| Send test digest | Triggers immediate digest | ⬜ | |
| Action queue display | Shows pending actions | ⬜ | |

### 7. Account (/account)
| Test | Expected | Status | Notes |
|------|----------|--------|-------|
| Page loads | Shows account info | ⬜ | |
| Subscription status | Shows current plan | ⬜ | |
| Upgrade button (if free) | Opens Stripe checkout | ⬜ | |
| Manage subscription | Opens Stripe portal | ⬜ | |
| Gmail connection status | Shows connected/disconnect | ⬜ | |
| Calendar connection status | Shows connected/disconnect | ⬜ | |
| Disconnect Gmail | Removes Gmail access | ⬜ | |
| Sign out | Logs out, clears session | ⬜ | |

### 8. Analytics (/analytics)
| Test | Expected | Status | Notes |
|------|----------|--------|-------|
| Page loads | Shows analytics dashboard | ⬜ | |
| Charts render | Displays email trends | ⬜ | |
| Date range filter | Can change time period | ⬜ | |
| Category breakdown | Shows distribution | ⬜ | |

### 9. Cross-Cutting Features
| Test | Expected | Status | Notes |
|------|----------|--------|-------|
| Sidebar navigation | All links work | ⬜ | |
| Mobile responsive | Works on mobile viewport | ⬜ | |
| Dark/light theme toggle | Switches themes | ⬜ | |
| Loading states | Spinners show during loads | ⬜ | |
| Error handling | Graceful error messages | ⬜ | |
| Session persistence | Stays logged in on refresh | ⬜ | |

### 10. Gmail Label Integration
| Test | Expected | Status | Notes |
|------|----------|--------|-------|
| Labels created in Gmail | 8 category labels exist | ⬜ | |
| Label colors match | Gmail colors = app colors | ⬜ | |
| Emails get labeled | Processed emails have labels | ⬜ | |
| Label sync updates | Renaming syncs to Gmail | ⬜ | |

---

## Test Execution Log

### Session: [DATE/TIME]

**Notes:**
- 
- 

**Issues Found:**
1. 
2. 

**Questions for Review:**
1. 
2. 

---

## How to Run Tests

1. Open browser to https://zenoemail.xix3d.com
2. Log in with test account (mirmi@xix3d.com)
3. Work through each section systematically
4. Mark status: ✅ Pass | ❌ Fail | ⚠️ Issue | ⬜ Not tested
5. Document any issues in Notes column
6. Screenshot/record any bugs

