#!/usr/bin/env node
/**
 * Generate CHANGELOG.json from git history at build time.
 * Groups commits by date, includes hash, message, and timestamp.
 * Output: public/changelog.json
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MAX_COMMITS = 100;

function generateChangelog() {
  const raw = execSync(
    `git log --format="%H||%ai||%s" -${MAX_COMMITS}`,
    { encoding: 'utf-8' }
  ).trim();

  if (!raw) {
    console.log('No git history found');
    return;
  }

  const commits = raw.split('\n').map(line => {
    const [hash, date, message] = line.split('||');
    return {
      hash: hash.substring(0, 7),
      fullHash: hash,
      date: date.trim(),
      day: date.trim().substring(0, 10),
      message: message.trim(),
      type: categorize(message.trim()),
    };
  });

  // Group by day
  const grouped = {};
  for (const c of commits) {
    if (!grouped[c.day]) grouped[c.day] = [];
    grouped[c.day].push(c);
  }

  const changelog = {
    generated: new Date().toISOString(),
    commitCount: commits.length,
    days: Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([day, commits]) => ({ day, commits })),
  };

  const outDir = path.join(__dirname, '..', 'public');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  
  fs.writeFileSync(
    path.join(outDir, 'changelog.json'),
    JSON.stringify(changelog, null, 2)
  );
  console.log(`✅ Changelog generated: ${commits.length} commits across ${changelog.days.length} days`);
}

function categorize(msg) {
  const lower = msg.toLowerCase();
  if (lower.startsWith('feat:') || lower.startsWith('feat(')) return 'feature';
  if (lower.startsWith('fix:') || lower.startsWith('fix(')) return 'fix';
  if (lower.startsWith('security:') || lower.includes('🔒')) return 'security';
  if (lower.startsWith('debug:')) return 'debug';
  if (lower.startsWith('ui:')) return 'ui';
  return 'other';
}

generateChangelog();
