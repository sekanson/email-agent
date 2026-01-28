# Settings Audit - Complete Inventory

## Database Settings (Supabase)

### User Settings Table (`user_settings`)
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `temperature` | number | 0.7 | AI response generation temperature |
| `signature` | string | "" | Email signature |
| `drafts_enabled` | boolean | true | Enable/disable draft generation |
| `auto_poll_enabled` | boolean | false | Auto-polling for new emails |
| `auto_poll_interval` | number | 120 | Polling interval in seconds |
| `categories` | Record<string, CategoryConfig> | DEFAULT_CATEGORIES | Email categorization rules |
| `use_writing_style` | boolean | false | Use personal writing style |
| `writing_style` | string | "" | Personal writing style text |
| `zeno_digest_enabled` | boolean | true | Enable email digest |
| `zeno_digest_types` | string[] | ["morning", "eod", "weekly"] | Digest types |
| `zeno_morning_time` | string | "09:00" | Morning digest time |
| `zeno_eod_time` | string | "18:00" | End of day digest time |
| `vip_senders` | string[] | [] | VIP sender email list |
| `focus_mode_enabled` | boolean | false | Focus mode active |
| `focus_mode_until` | timestamp | null | Focus mode end time |
| `timezone` | string | "America/New_York" | User timezone |
| `zeno_confirmations` | boolean | true | Require confirmations |

### Users Table (`users.notification_preferences`)
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `timezone` | string | undefined | Notification timezone |
| `quiet_hours_start` | string | undefined | Quiet hours start |
| `quiet_hours_end` | string | undefined | Quiet hours end |

## Client-Side Settings (localStorage)

### User Session Data
| Setting | Type | Description |
|---------|------|-------------|
| `userEmail` | string | Current user email |
| `userName` | string | Current user name |
| `userPicture` | string | User profile picture URL |
| `subscriptionStatus` | string | Subscription status |
| `isAdmin` | boolean | Admin privileges flag |
| `userRole` | string | User role |

### UI Preferences
| Setting | Type | Description |
|---------|------|-------------|
| `theme` | string | UI theme (dark/light) |
| `autoPolling` | boolean | Dashboard auto-refresh |
| `pollInterval` | number | Dashboard refresh interval |
| `agentEnabled` | boolean | Agent functionality state |

### Feature State
| Setting | Type | Description |
|---------|------|-------------|
| `declutter_total_scanned` | number | Declutter progress counter |
| `declutter_blocked_senders` | string[] | Blocked sender list |

## Category Configuration Structure
```typescript
interface CategoryConfig {
  name: string;
  color: string;
  enabled: boolean;
  required?: boolean;
  description: string;
  rules?: string;
  drafts?: boolean;
  order: number;
}
```

## Current Default Categories (v1)
1. Reply Needed (#fb4c2f, drafts: true)
2. For Info (#ffad47, drafts: false)
3. Mentions (#2da2bb, drafts: false)
4. Alerts (#43d692, drafts: false)
5. Calendar (#a479e2, drafts: false)
6. Waiting (#4a86e8, drafts: false)
7. Actioned! (#16a766, drafts: false)
8. Ad/Spam (#f691b3, drafts: false)