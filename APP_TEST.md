# 🧪 Zeno App Test

**URL:** https://zenoemail.xix3d.com
**Test Account:** mirmi@xix3d.com

---

## Quick Commands

- **"Run the app test"** → Full test of all features
- **"Run app test on [feature]"** → Test specific feature
- **"Run app test on latest push"** → Test most recent changes

---

## Feature Test Modules

### 🔐 AUTH
- [ ] Landing page loads
- [ ] Google OAuth flow works
- [ ] Session persists on refresh
- [ ] Logout clears session

### 📊 DASHBOARD
- [ ] Page loads with metrics
- [ ] Scan & Classify processes emails
- [ ] Email list displays correctly
- [ ] Category filter works
- [ ] Reset Metrics (custom modal)

### 🏷️ CATEGORIZE
- [ ] Shows 8 default categories
- [ ] Can edit name/color/description/rules
- [ ] Save & Sync creates Gmail labels
- [ ] Restore Defaults (custom modal)
- [ ] Start Fresh deletes all labels (custom modal)
- [ ] Category upgrade prompt (v1→v2)

### ✍️ DRAFTS
- [ ] Temperature slider works
- [ ] Analyze Writing Style works
- [ ] Signature editor/preview works
- [ ] Drafts enable/disable toggle
- [ ] Reset to Defaults (custom modal)

### 🧹 DECLUTTER
- [ ] Scan finds clutter emails
- [ ] Selection checkboxes work
- [ ] Bulk unsubscribe (custom modal)
- [ ] Mark as read works
- [ ] Block sender works

### 🤖 ASSISTANT (Zeno)
- [ ] Digest settings configurable
- [ ] VIP senders list works
- [ ] Focus Mode toggle works
- [ ] Test digest sends
- [ ] Action queue displays

### 👤 ACCOUNT
- [ ] Shows subscription status
- [ ] Gmail connection status
- [ ] Calendar connection status
- [ ] Upgrade/manage subscription
- [ ] Disconnect integrations

### 📈 ANALYTICS
- [ ] Charts render
- [ ] Date range filter works
- [ ] Category breakdown shows

### 🎨 UI/UX
- [ ] Sidebar navigation works
- [ ] Mobile responsive
- [ ] Dark/light theme toggle
- [ ] Loading spinners show
- [ ] Error messages display
- [ ] Custom modals (not browser alerts)

### 📧 GMAIL INTEGRATION
- [ ] Labels created correctly
- [ ] Label colors match app
- [ ] Emails get labeled on scan
- [ ] Label sync on rename

---

## Recent Test Results

### [Date: ____]
**Scope:** [Full / Feature name]
**Result:** [Pass / Issues found]

**Issues:**
1. 

**Notes:**
- 

---

## Known Issues Tracker

| Issue | Severity | Status | Notes |
|-------|----------|--------|-------|
| | | | |

---

## Test Execution Steps

### Full Test
1. Check API health endpoints
2. Verify all pages load (200 status)
3. Test each feature module
4. Document any failures
5. Report summary

### Feature Test
1. Identify changed files from recent commit
2. Map to affected features
3. Test those specific features
4. Regression test related features
5. Report findings

