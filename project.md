Build a complete, production-quality **self-hosted Developer + Server Management Panel** for my own Ubuntu Linux server.

This is NOT just a code editor.

It should be a unified panel combining:

1. VS Code / GitHub Codespaces-style web code editor
2. GitHub repository integration
3. Git clone / pull / commit / push
4. Server monitoring
5. Security dashboard
6. Rate limiting configuration
7. IP blocking/unblocking management
8. Request analytics
9. CPU/RAM/Swap monitoring
10. System/service monitoring
11. Team/user access control
12. Audit logs
13. Settings

The panel should be designed so my team can manage/edit the project from the browser WITHOUT giving them SSH or Linux shell access to the production server.

IMPORTANT:
Do not modify, migrate, replace, or depend on my existing application database schema.

The panel's own metadata may use a separate database/database namespace if required, but it must never modify the existing website's MongoDB data.

---

# 1. TECHNOLOGY STACK

Use:

Frontend:
- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Monaco Editor
- xterm.js
- react-resizable-panels
- Lucide icons

Backend:
- Next.js server/API layer or a dedicated Node.js backend
- TypeScript
- WebSocket support
- node-pty where required

Git:
- simple-git or Git CLI through a tightly controlled backend wrapper

GitHub:
- GitHub OAuth or GitHub App

Monitoring:
- Node.js system metrics
- OS-level metrics through safe libraries/commands
- CPU
- RAM
- Swap
- Disk
- Load average
- Network
- Process/service status

Security:
- Authentication
- RBAC
- Rate limiting
- IP blocklist
- IP allowlist
- Temporary blocks
- Permanent blocks
- Audit logging

Database:
- MongoDB may be used ONLY for the PANEL'S OWN metadata.
- Never touch the existing website's MongoDB database/schema.
- Clearly separate panel database from application database.

---

# 2. MAIN DASHBOARD

Create a professional dashboard similar to modern hosting/developer panels.

Layout:

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Logo     Dashboard   Editor   Git   Security   Monitoring   Admin  │
│                                                     User ▼         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ CPU                 RAM                 SWAP              LOAD       │
│ 24%                 41%                12%               1.21       │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Server Status             Network             Requests              │
│ ● Online                  ↓ 12 MB/s          2,481/min              │
│                           ↑ 4 MB/s           12 blocked              │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ Security                                                        │
│                                                                     │
│ Rate Limit: Enabled       Blocked IPs: 24       Active rules: 4    │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ Recent Activity                                                     │
│                                                                     │
│ Git push     developer1     2 minutes ago                           │
│ IP blocked   185.x.x.x     5 minutes ago                           │
│ Login        developer2     10 minutes ago                          │
└─────────────────────────────────────────────────────────────────────┘
```

Dashboard must update metrics live using WebSockets/SSE where appropriate.

---

# 3. WEB CODE EDITOR

Create a complete VS Code-style browser editor.

Use Monaco Editor.

Features:

- File explorer
- Folder tree
- Open files
- Multiple tabs
- Syntax highlighting
- Autocomplete
- Search
- Replace
- Minimap
- Line numbers
- Error markers
- Dirty file indicator
- Save
- Auto-save
- File creation
- Folder creation
- Rename
- Delete
- Copy
- Paste
- Context menu
- Drag and drop files where safe
- Command palette
- Keyboard shortcuts

Support:

- JavaScript
- TypeScript
- JSX
- TSX
- JSON
- HTML
- CSS
- Markdown
- Python
- Java
- C
- C++
- C#
- Go
- YAML
- SQL
- Shell

---

# 4. TERMINAL

Add an integrated terminal at the bottom.

It should behave like VS Code.

The terminal panel must be vertically resizable:

```text
┌───────────────────────────────────────┐
│                                       │
│            CODE EDITOR                │
│                                       │
├───────────────────────────────────────┤ ← drag
│ TERMINAL                              │
│                                       │
│ $ git status                          │
│ $ npm run build                       │
│                                       │
└───────────────────────────────────────┘
```

Use:

- xterm.js
- WebSocket
- node-pty

CRITICAL SECURITY REQUIREMENT:

DO NOT expose the host's unrestricted Linux shell to team members.

The terminal must execute inside an isolated workspace/container or a tightly restricted execution environment.

Never expose:

```text
/etc
/root
/var/run/docker.sock
host filesystem
host Docker daemon
```

directly to the user.

---

# 5. GITHUB CONNECTION

Create a GitHub section.

User can:

```text
Connect GitHub
       ↓
Authenticate
       ↓
List repositories
       ↓
Select repository
       ↓
Select branch
       ↓
Clone/Open workspace
```

Allow:

- GitHub login
- Repository list
- Repository search
- Branch list
- Branch creation
- Branch switching
- Pull
- Commit
- Push
- Git status
- Git diff
- Pull requests

Provide a field:

```text
Git Repository URL
[ https://github.com/user/repository.git ]

[Connect Repository]
```

Support both:

- HTTPS Git URLs
- SSH Git URLs where properly configured

Never expose GitHub access tokens to the browser unnecessarily.

Store credentials securely.

---

# 6. GIT PANEL

Create a Git sidebar similar to VS Code.

Example:

```text
SOURCE CONTROL

Changes (4)

M  src/App.tsx
M  src/api.ts
A  src/components/New.tsx
?  test.txt

Commit message:
[ Fix API authentication ]

[Commit]
[Commit & Push]

Branch:
main ▼

[Pull]
[Push]
[Create Branch]
```

Also show:

- Commit history
- Commit details
- Changed files
- Diff viewer
- Current branch
- Remote URL
- Ahead/behind status

---

# 7. CODE SAVE / DATABASE ISOLATION

IMPORTANT:

The editor must NOT save source code into MongoDB.

Source code should remain in the Git workspace filesystem.

For example:

```text
/workspaces/
    project-123/
        client/
        server/
        package.json
        ...
```

MongoDB, if used by the panel, should store only metadata such as:

```text
users
workspaces
github_connections
permissions
security_rules
blocked_ips
audit_logs
settings
```

The existing application's database must remain completely untouched.

---

# 8. SERVER MONITORING

Create a complete Monitoring page.

Show:

CPU:

```text
Current: 32%
Average: 28%
Peak: 78%
```

RAM:

```text
Used: 3.2 GB
Total: 8 GB
Usage: 40%
```

Swap:

```text
Used: 512 MB
Total: 6 GB
Usage: 8%
```

Load:

```text
1 min: 1.20
5 min: 0.94
15 min: 0.82
```

Disk:

```text
Root: 72%
Storage: 61%
```

Network:

```text
Download: 18 MB/s
Upload: 5 MB/s
```

Display graphs for:

- CPU
- RAM
- Swap
- Disk
- Network
- Load average
- Requests
- Blocked requests

Allow time ranges:

```text
5 minutes
15 minutes
1 hour
6 hours
24 hours
7 days
```

---

# 9. PROCESS MONITOR

Create a process monitoring page.

Show:

```text
Process          CPU      RAM       Status
nginx            1.2%     40MB      Running
node             8.4%     210MB     Running
mongod           3.1%     350MB     Running
cloudflared      0.4%     35MB      Running
```

Team members should NOT automatically receive arbitrary process-kill permissions.

Only OWNER/ADMIN can perform privileged actions.

---

# 10. SERVICE MONITOR

Show system services:

```text
nginx          ● Running
mongod         ● Running
cloudflared    ● Running
diet-website   ● Running
```

Provide:

```text
View Logs
Restart
Stop
Start
```

But permission-check every action.

Developers should not be allowed to stop critical services unless explicitly authorized.

---

# 11. SECURITY DASHBOARD

Create a dedicated Security page.

Show:

```text
Security Overview

Rate Limiting          ENABLED
IP Protection          ENABLED
Authentication         ENABLED
Audit Logging          ENABLED

Blocked IPs            24
Temporary Blocks       8
Permanent Blocks       16
Requests Blocked       12,481
```

---

# 12. RATE LIMITING

Create a full configurable rate-limit system.

Admin UI:

```text
Rate Limiting

Status:
[ ON ]

Requests:
[ 100 ]

Window:
[ 60 ] seconds

Action:
[ Temporary Block ]

Block duration:
[ 10 ] minutes

Apply to:
[ Global ]

[Save Rule]
```

Allow rules such as:

```text
100 requests / 60 seconds
500 requests / 5 minutes
5000 requests / 1 hour
```

Allow configuration for:

- Global
- API
- Login
- Upload
- Specific route

Example:

```text
POST /api/login
5 requests / minute
→ block IP for 15 minutes
```

---

# 13. IP BLOCKING

Create an IP management page.

Tabs:

```text
Blocked
Temporary
Permanent
Allowlist
History
```

Example:

```text
IP Address       Reason             Duration       Status

185.x.x.x        Rate limit         15 min         Blocked
103.x.x.x        Suspicious         Permanent      Blocked
45.x.x.x         Manual             1 hour         Blocked
```

Actions:

```text
[Block]
[Unblock]
[Extend]
[Edit]
[View Details]
```

Allow manual block:

```text
IP:
[ 1.2.3.4 ]

Reason:
[ Suspicious traffic ]

Duration:
[ 1 hour ▼ ]

[Block IP]
```

Duration options:

```text
5 minutes
10 minutes
15 minutes
30 minutes
1 hour
6 hours
12 hours
24 hours
7 days
30 days
Permanent
Custom
```

---

# 14. BLOCK SETTINGS

Allow admins to configure automatic blocking.

Example:

```text
Automatic Protection

☑ Enable rate limiting

Requests threshold:
[ 100 ]

Window:
[ 60 seconds ]

When exceeded:
[ Block IP ]

Block duration:
[ 15 minutes ]

Repeat offender:
[ Increase block duration ]

Maximum:
[ 24 hours ]
```

For repeat offenders:

```text
1st violation → 5 min
2nd violation → 15 min
3rd violation → 1 hour
4th violation → 6 hours
5th violation → 24 hours
```

Make these values configurable.

---

# 15. REQUEST MONITORING

Create a real-time request monitor.

Show:

```text
Time       IP            Method   Route          Status
12:01:02   1.2.3.4       GET      /api/users     200
12:01:03   5.6.7.8       POST     /api/login     401
12:01:04   1.2.3.4       GET      /api/users     429
```

Display:

- Requests/sec
- Requests/min
- 2xx
- 3xx
- 4xx
- 5xx
- 429
- blocked requests
- top IPs
- top routes
- suspicious IPs

Do not store excessive raw request logs forever.

Implement retention settings.

---

# 16. IP DETAILS

When clicking an IP, show:

```text
IP: 1.2.3.4

Requests:
12,481

Blocked:
32

Last request:
2 minutes ago

Routes:
GET /api/login
POST /api/login
GET /api/users

Status:
Blocked

Reason:
Rate limit exceeded

Block expires:
14 minutes
```

Show request history if available.

---

# 17. SECURITY RULE ENGINE

Create configurable rules.

Example:

```text
Rule Name:
Login Protection

Route:
/api/login

Method:
POST

Threshold:
5 requests

Window:
60 seconds

Action:
Block

Duration:
15 minutes
```

Allow:

- Enable/disable
- Edit
- Duplicate
- Delete
- Priority/order

Rules should be processed safely and efficiently.

---

# 18. IP ALLOWLIST

Create an allowlist.

Allow trusted IPs to bypass certain rate limits.

Example:

```text
203.x.x.x
Office IP
```

IMPORTANT:

Never allow an admin to accidentally lock themselves out without confirmation.

Before blocking the current admin's IP, show a confirmation.

---

# 19. SECURITY EVENTS

Create:

```text
Security Events

Rate limit exceeded
IP blocked
IP unblocked
Failed login
Successful login
Suspicious request
Permission denied
```

Each event should include:

- Timestamp
- User
- IP
- Action
- Reason
- Target
- Result

---

# 20. AUDIT LOGS

Everything important must be logged.

Example:

```text
User: developer1
Action: Git Push
Repository: diet-website
Time: 12:41 PM
IP: 1.2.3.4
Result: Success
```

Log:

- Login
- Logout
- Git clone
- Git pull
- Git push
- Commit
- File changes
- User creation
- Permission changes
- Security rule changes
- IP block/unblock
- Service restart
- Deployment

---

# 21. TEAM MANAGEMENT

Create Admin → Team page.

Roles:

```text
OWNER
ADMIN
DEVELOPER
VIEWER
```

Permissions:

OWNER:
- Everything

ADMIN:
- Users
- Security
- Monitoring
- Git
- Workspaces

DEVELOPER:
- Code editor
- Assigned repositories
- Git
- Terminal inside workspace
- Preview

VIEWER:
- Read-only code access
- Monitoring read-only

Permissions must be checked server-side.

Never trust frontend role checks alone.

---

# 22. SECURITY SETTINGS PAGE

Create:

```text
Security Settings

[✓] Rate limiting
[✓] IP blocking
[✓] Audit logs
[✓] Secure headers
[✓] Login protection

Session timeout:
[ 60 minutes ]

Maximum login attempts:
[ 5 ]

Login lockout:
[ 15 minutes ]

Request log retention:
[ 7 days ]

Security event retention:
[ 30 days ]
```

---

# 23. SETTINGS

Create settings sections:

```text
General
Security
GitHub
Workspaces
Rate Limits
IP Management
Monitoring
Logs
Notifications
Users
```

---

# 24. NOTIFICATIONS

Show alerts for:

```text
CPU > 90%
RAM > 90%
Swap > 80%
Disk > 90%
High request rate
Large number of blocked IPs
Service down
MongoDB unavailable
Nginx unavailable
```

Allow configurable thresholds.

---

# 25. HEALTH CHECK

Create a health page:

```text
System Health

CPU             ● Healthy
Memory          ● Healthy
Swap            ● Healthy
Disk            ● Healthy
MongoDB         ● Healthy
Nginx           ● Healthy
Cloudflare      ● Healthy
Application     ● Healthy
```

Each service should have:

```text
Check
Latency
Status
Last checked
```

---

# 26. SERVER ACTIONS

Create a controlled server actions panel.

Only OWNER/ADMIN.

Actions:

```text
Restart Nginx
Restart Application
Restart MongoDB
Restart Cloudflare Tunnel
```

Do not expose arbitrary shell commands through this feature.

Use an explicit allowlist of safe commands/actions.

---

# 27. LOG VIEWER

Create a log viewer.

Support:

```text
Application Logs
Nginx Logs
Security Logs
Audit Logs
System Logs
```

Features:

- Live tail
- Search
- Filter
- Date range
- Download
- Clear only where permitted

Do not allow arbitrary filesystem path input.

Map predefined log sources to safe files.

---

# 28. DEPLOYMENT

Create a deployment page.

Flow:

```text
GitHub
 ↓
Select Repository
 ↓
Select Branch
 ↓
Pull
 ↓
Build
 ↓
Health Check
 ↓
Deploy
```

Show deployment progress:

```text
✓ Git pull
✓ Dependencies
✓ Build
✓ Health check
✓ Deployment
```

If deployment fails:

```text
Deployment failed

Reason:
Build command exited with code 1

[View Logs]
```

---

# 29. DO NOT BREAK EXISTING APPLICATION

The panel must be isolated from the existing website.

Do not:

- Change existing MongoDB database
- Change existing application schema
- Delete existing uploads
- Modify existing website files unless explicitly deploying through Git
- Expose MongoDB
- Expose SSH
- Change existing Nginx configuration automatically
- Change firewall rules without explicit admin action

The panel should initially operate independently.

---

# 30. DATABASE ISOLATION

If MongoDB is used:

Existing application:

```text
mongodb://127.0.0.1:27017/diet_ghazipur
```

Panel:

```text
mongodb://127.0.0.1:27017/devpanel
```

These must be completely separate databases.

The panel must never run destructive commands against `diet_ghazipur`.

---

# 31. HOST SECURITY

The application itself must never give users unrestricted access to:

```text
/
 /root
 /etc
 /var
 /usr
 /home
 /var/run/docker.sock
```

The editor workspace must have an explicit root directory.

Every file path must be resolved and verified to remain inside that directory.

Protect against:

```text
../
../../
absolute paths
symlinks escaping workspace
command injection
shell injection
```

---

# 32. RATE LIMIT IMPLEMENTATION

Do not rely only on frontend JavaScript.

Implement rate limiting on the server/API layer.

Prefer a centralized/atomic storage mechanism for production, such as Redis, if multiple application instances may exist.

For a single-server MVP, an in-memory implementation can be used, but clearly document that it is not persistent and does not scale across multiple instances.

Do not create a fake rate-limit UI.

The controls must actually affect requests.

---

# 33. PERFORMANCE

The monitoring system must not consume excessive CPU/RAM.

Do not poll the server every 100ms.

Use reasonable intervals such as:

```text
1-5 seconds for live metrics
```

and aggregate historical metrics efficiently.

Use WebSocket/SSE for real-time updates where appropriate.

---

# 34. RESPONSIVE DESIGN

Desktop-first because this is a developer panel.

Also support tablet.

On mobile, provide a simplified dashboard.

The code editor should display an appropriate mobile warning or simplified interface rather than breaking.

---

# 35. UI STYLE

Create a polished developer-focused dark interface.

Use:

- Dark background
- Cards
- Subtle borders
- Green healthy indicators
- Red danger indicators
- Yellow warnings
- Blue information states
- Smooth transitions
- Tooltips
- Toasts
- Skeleton loading
- Empty states
- Confirmation dialogs for destructive actions

Do not make it look like a generic admin template.

Make it feel like:

```text
VS Code
+
Cloudflare dashboard
+
Vercel
+
GitHub
+
server monitoring panel
```

---

# 36. COMMAND PALETTE

Implement:

```text
Ctrl + Shift + P
```

Commands:

```text
Open File
Save File
Search Files
Toggle Terminal
Toggle Explorer
Git Status
Git Pull
Git Push
Commit
Create Branch
Switch Branch
Start Workspace
Stop Workspace
Open Preview
Open Monitoring
Open Security
Block IP
Unblock IP
Restart Application
```

---

# 37. SECURITY OF COMMAND EXECUTION

NEVER allow:

```text
POST /api/execute
{
  "command": "whatever"
}
```

where arbitrary commands are executed on the host.

Instead expose specific actions:

```text
POST /api/git/pull
POST /api/git/push
POST /api/deploy
POST /api/services/nginx/restart
POST /api/services/application/restart
```

Each action must have:

- Authentication
- Authorization
- Input validation
- Audit log
- Allowlist

---

# 38. PROJECT STRUCTURE

Use a clean production structure such as:

```text
devpanel/
├── app/
│   ├── dashboard/
│   ├── editor/
│   ├── git/
│   ├── security/
│   ├── monitoring/
│   ├── team/
│   ├── settings/
│   └── api/
│
├── components/
│   ├── editor/
│   ├── terminal/
│   ├── explorer/
│   ├── git/
│   ├── monitoring/
│   ├── security/
│   ├── dashboard/
│   └── ui/
│
├── lib/
│   ├── auth/
│   ├── github/
│   ├── git/
│   ├── docker/
│   ├── filesystem/
│   ├── monitoring/
│   ├── security/
│   └── database/
│
├── docker/
│   └── workspace/
│
├── public/
├── scripts/
├── .env.example
├── docker-compose.yml
├── package.json
└── README.md
```

---

# 39. LOCAL DEVELOPMENT

The first target is my Windows PC.

It must run locally.

Provide:

```bash
npm install
npm run dev
```

If Docker is required:

```bash
docker compose up -d
npm run dev
```

The application should be accessible at:

```text
http://localhost:3000
```

---

# 40. PRODUCTION DEPLOYMENT

After local development works, provide complete Ubuntu deployment documentation.

Target:

```text
Ubuntu 24.04
Nginx
Node.js
Docker
MongoDB
Cloudflare Tunnel
```

Do not automatically modify the server.

Provide commands and explain each change.

---

# 41. ENVIRONMENT VARIABLES

Create `.env.example`.

Example:

```env
NODE_ENV=development

APP_URL=http://localhost:3000

PANEL_MONGODB_URI=mongodb://127.0.0.1:27017/devpanel

SESSION_SECRET=

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=

WORKSPACE_ROOT=

RATE_LIMIT_ENABLED=true

MONITORING_ENABLED=true
```

Never hardcode credentials.

---

# 42. README

Create a detailed README containing:

- Architecture
- Installation
- Local setup
- Docker setup
- MongoDB setup
- GitHub OAuth setup
- Workspace setup
- Security model
- Rate limiting
- IP blocking
- Monitoring
- Production deployment
- Backup
- Troubleshooting

---

# 43. TESTING

Create tests for:

Authentication
Authorization
Path traversal
Rate limiting
IP blocking
Git operations
Workspace permissions
Security rules
API validation

Test cases must include malicious inputs.

Examples:

```text
../../etc/passwd
/etc/passwd
../.env
command injection attempts
invalid workspace IDs
unauthorized workspace access
unauthorized GitHub repository access
```

---

# 44. FINAL REQUIREMENT

Do not build a fake prototype.

Build a functional MVP where:

- GitHub repository can actually be connected
- Repository can actually be cloned
- Files can actually be edited
- Files can actually be saved
- Git status actually works
- Commit actually works
- Push actually works
- Terminal actually works inside an isolated workspace
- CPU/RAM/Swap monitoring actually works
- Rate limiting actually works
- IP blocking actually works
- IP unblocking actually works
- Block durations actually work
- Security rules actually work
- Audit logs actually work
- Team permissions actually work
- Existing application database remains untouched

If a feature cannot safely be implemented on the host, isolate it inside Docker rather than exposing the host.

Prioritize security over convenience.

Do not create an unrestricted remote shell.

Do not expose MongoDB publicly.

Do not expose Docker socket to users.

Do not store source code in MongoDB.

Keep the existing production application completely separate from this panel.

Build the application incrementally, but keep every stage runnable.