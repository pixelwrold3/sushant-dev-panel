# DevPanel – Fix Existing Project Targeting & Add Connected Projects

You are working on my existing self-hosted DevPanel repository.

## CRITICAL CONTEXT

This repository is the **DevPanel itself**.

The DevPanel is already running on my Ubuntu server.

There is another completely separate application called **Diet Ghazipur**, which is my already-published/live website.

I DO NOT want DevPanel to edit its own source code when I select the Diet Ghazipur project.

I want DevPanel to act like a self-hosted Codespaces/Vercel-style management panel where I can connect an existing server project and manage that project from the DevPanel.

### Current real directories

DevPanel:

```text
/var/www/sushant-dev-panel
```

Diet Ghazipur live website:

```text
/var/www/diet-website
```

The DevPanel must remain at:

```text
/var/www/sushant-dev-panel
```

The Diet Ghazipur project must remain at:

```text
/var/www/diet-website
```

DO NOT move, rename, delete, or clone over these directories.

---

# 1. FIX THE CURRENT WORKSPACE SYSTEM

Currently `.env` contains:

```env
WORKSPACE_ROOT=./workspaces
```

and the existing UI displays:

```text
Main Application Project (main)
```

which currently points to:

```text
/var/www/sushant-dev-panel/workspaces/main-website
```

This is NOT what I want for an existing connected project.

The existing `workspaces/` mechanism can remain for sandbox/new projects, but we need a new concept:

# CONNECTED PROJECTS

A Connected Project represents an existing real server directory.

Example:

```text
Name:
Diet Ghazipur

Directory:
/var/www/diet-website

Git Repository:
https://github.com/...

Branch:
main
```

When I select:

```text
Diet Ghazipur
```

the entire DevPanel editor must operate on:

```text
/var/www/diet-website
```

NOT:

```text
/var/www/sushant-dev-panel
```

and NOT:

```text
/var/www/sushant-dev-panel/workspaces/main-website
```

---

# 2. ADD "CONNECT PROJECT"

Add a button in the workspace/project selector area:

```text
Workspace: [ Diet Ghazipur ▼ ]  [ + Connect Project ]
```

Clicking `+ Connect Project` opens a modal.

Fields:

```text
Project Name
Directory Path
Git Repository URL
Branch
Runtime
Build Command
Start/Restart Command
```

Example:

```text
Project Name:
Diet Ghazipur

Directory:
 /var/www/diet-website

Git Repository:
 https://github.com/username/repository.git

Branch:
 main

Runtime:
 Node.js

Build Command:
 npm run build

Restart Command:
 systemctl restart diet-website
```

The project must be saved to the DevPanel's own metadata database.

DO NOT store the project's source code in MongoDB.

Only store metadata.

---

# 3. CONNECT EXISTING DIRECTORY

The most important feature:

If I enter:

```text
/var/www/diet-website
```

the DevPanel must connect to that EXISTING directory.

It must NOT clone the repository again.

It must NOT create:

```text
/var/www/sushant-dev-panel/workspaces/diet-ghazipur
```

It must directly use:

```text
/var/www/diet-website
```

for that connected project.

Before connecting:

- verify the path exists
- verify it is a directory
- verify it is accessible
- resolve symlinks safely
- reject dangerous paths
- prevent `..` traversal
- prevent arbitrary filesystem access

---

# 4. SECURITY IS EXTREMELY IMPORTANT

Do NOT simply remove the current workspace security and allow arbitrary filesystem paths.

Create an explicit allowlist of connected project directories.

Example:

```text
Connected Projects:

diet-ghazipur
    /var/www/diet-website

another-site
    /var/www/another-site
```

The user can only access directories that were explicitly connected by an authorized admin.

Never allow a request like:

```text
/api/files?path=/etc/passwd
```

Never allow:

```text
../../etc/passwd
```

Never allow escaping from the registered project root.

Every filesystem operation must resolve against the selected project's registered root directory.

---

# 5. EDITOR MUST TARGET THE SELECTED PROJECT

Current behavior:

```text
Main Application Project
        ↓
/var/www/sushant-dev-panel/workspaces/main-website
```

New behavior:

```text
Diet Ghazipur
        ↓
/var/www/diet-website
```

The Explorer must show the actual Diet Ghazipur files.

For example:

```text
diet-website
├── client
├── server
├── package.json
├── README.md
└── ...
```

The Monaco editor must read/write these actual files.

Saving a file must modify the real file on the server.

---

# 6. TERMINAL MUST TARGET SELECTED PROJECT

When:

```text
Diet Ghazipur
```

is selected, the terminal working directory must be:

```text
/var/www/diet-website
```

Terminal prompt can show:

```text
workspace@diet-ghazipur:~$
```

but the actual process cwd must be:

```text
/var/www/diet-website
```

Commands such as:

```bash
pwd
ls
npm install
npm run build
git status
git pull
git push
```

must operate inside the connected project.

Do NOT allow the terminal to escape the registered project directory.

Keep the existing security model and improve it where necessary.

---

# 7. GIT MUST OPERATE ON THE SELECTED PROJECT

If Diet Ghazipur is selected:

```text
Git Status
Git Diff
Stage
Commit
Pull
Push
Branch
```

must execute against:

```text
/var/www/diet-website
```

NOT the DevPanel repository.

Example:

```text
DevPanel repository:
 /var/www/sushant-dev-panel

Diet repository:
 /var/www/diet-website
```

These must remain completely separate Git repositories.

---

# 8. GIT REPOSITORY CONNECTION

When connecting an existing project, detect whether the directory already contains:

```text
.git
```

If it does:

- detect remote URL
- detect current branch
- detect repository status
- show it in the project settings

If the user enters a GitHub URL, associate that URL with the project metadata.

DO NOT automatically clone if the directory already contains the repository.

---

# 9. PROJECT DROPDOWN

Replace the current confusing "Workspace" concept with a proper project selector.

Example:

```text
Project: [ Diet Ghazipur ▼ ]
```

Dropdown:

```text
Projects

● Diet Ghazipur
  /var/www/diet-website

● Another Website
  /var/www/another-site

──────────────

+ Connect Existing Project
+ Create New Workspace
```

The selected project ID must be sent to every editor, terminal, Git, deployment and file API.

Never hardcode:

```text
main-website
```

as the active project.

---

# 10. DEPLOY BUTTON

This is very important.

For each connected project, allow configurable:

```text
Build Command
Install Command
Start Command
Restart Command
```

Example Diet Ghazipur:

```text
Install:
npm install

Build:
npm run build

Restart:
systemctl restart diet-website
```

When clicking:

```text
Deploy
```

run:

```text
1. Git pull
2. Install dependencies
3. Build project
4. Health check
5. Restart application
6. Verify application
```

Do NOT fake deployment success.

The current implementation appears to have deployment steps that can report successful-looking results without actually performing the complete deployment.

Fix this.

Deployment status must represent real command execution.

---

# 11. RESTART / SERVICE MANAGEMENT

Add a project-level:

```text
Restart
```

button.

For Diet Ghazipur:

```text
Restart
↓
systemctl restart diet-website
```

Then:

```text
systemctl is-active diet-website
```

must be checked.

Show:

```text
Running
Failed
Restarting
Stopped
```

Do not expose an arbitrary:

```text
/api/execute?command=...
```

endpoint.

Only execute explicitly configured/allowlisted commands.

---

# 12. SERVER REBOOT

Add a proper server management action:

```text
Server
├── Restart Application
├── Restart Service
└── Reboot Server
```

The DevPanel itself must automatically start after an Ubuntu reboot.

Create/fix a proper systemd service for DevPanel.

Example:

```text
devpanel.service
```

with:

```text
WorkingDirectory=/var/www/sushant-dev-panel
ExecStart=/usr/bin/node /var/www/sushant-dev-panel/server.mjs
Restart=always
```

Use the correct Node binary/path detected on the server.

Enable it:

```bash
systemctl enable devpanel
```

The panel must survive server reboots.

Do not use a development-only process as the production mechanism.

---

# 13. PROJECT AUTO-START

Each connected application may optionally have:

```text
Auto Start: ON/OFF
```

If enabled, its configured systemd service should automatically start after reboot.

Do not blindly run arbitrary commands at boot.

Use explicitly configured service names and allowlisted service actions.

---

# 14. DIET GHAZIPUR SHOULD BE THE FIRST CONNECTED PROJECT

Add/import:

```text
Diet Ghazipur
```

with:

```text
Path:
/var/www/diet-website
```

Do not modify the Diet Ghazipur application source code.

Do not move it.

Do not delete it.

Do not clone another copy.

The DevPanel should simply manage the existing application.

---

# 15. EXISTING DEVPanel MUST REMAIN SEPARATE

The DevPanel itself:

```text
/var/www/sushant-dev-panel
```

must never become a selectable source-code target merely because the DevPanel is running from that directory.

Keep:

```text
DevPanel source
```

and:

```text
Connected application source
```

separate.

---

# 16. DATABASE

Use the existing DevPanel metadata database:

```text
mongodb://127.0.0.1:27017/devpanel
```

Store:

```text
Project ID
Project Name
Filesystem Path
Git URL
Git Branch
Runtime
Install Command
Build Command
Start Command
Restart Command
Systemd Service
Auto Start
Created At
Updated At
```

Do NOT store source files in MongoDB.

Do NOT use the existing Diet Ghazipur database.

The Diet Ghazipur application database must remain completely separate.

---

# 17. BACKWARD COMPATIBILITY

Do not break:

- Dashboard
- Security
- Monitoring
- Git
- Team
- Settings
- Existing authentication
- Rate limiting
- Audit logs
- Existing workspace functionality

Refactor the filesystem abstraction so both can exist:

```text
Sandbox Workspace
        ↓
WORKSPACE_ROOT/workspace-id

Connected Project
        ↓
Explicit registered absolute path
```

Use one common secure filesystem interface where possible.

---

# 18. API DESIGN

Implement clean APIs such as:

```text
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PATCH  /api/projects/:id
DELETE /api/projects/:id

POST   /api/projects/:id/verify

GET    /api/projects/:id/files
GET    /api/projects/:id/file
PUT    /api/projects/:id/file

GET    /api/projects/:id/git/status
POST   /api/projects/:id/git/action

POST   /api/projects/:id/deploy
POST   /api/projects/:id/restart
GET    /api/projects/:id/status
```

Adapt this to the existing architecture instead of blindly duplicating existing APIs.

---

# 19. DO NOT FAKE DATA

This is critical.

If the UI says:

```text
CPU 1%
RAM 45%
Server Online
Deployment Successful
Git Push Successful
Application Running
```

the backend must obtain real information.

Do not create mock values just to make the UI look functional.

The same applies to:

- Git
- Deployment
- Monitoring
- Service status
- Restart
- Terminal
- File system
- Security events

---

# 20. TEST THE REAL SCENARIO

After implementation, test exactly this:

### Step 1

Connect:

```text
Diet Ghazipur
/var/www/diet-website
```

### Step 2

Select:

```text
Diet Ghazipur
```

### Step 3

Explorer must show actual files from:

```text
/var/www/diet-website
```

### Step 4

Open a real file.

Modify it.

Save.

Verify from SSH:

```bash
cat /var/www/diet-website/<file>
```

### Step 5

Open terminal and run:

```bash
pwd
```

Expected:

```text
/var/www/diet-website
```

### Step 6

Run:

```bash
git status
```

It must show the Diet Ghazipur repository status.

### Step 7

Run Deploy.

It must execute the configured real deployment commands.

### Step 8

Restart the configured Diet Ghazipur service.

Verify:

```bash
systemctl is-active diet-website
```

### Step 9

Reboot Ubuntu.

After reboot:

- DevPanel must automatically start
- Diet Ghazipur service must automatically start if Auto Start is enabled
- Connected Project must still exist
- Project path must remain `/var/www/diet-website`

---

# 21. IMPORTANT: DO NOT DESTROY EXISTING DATA

Before modifying anything:

- inspect the existing project
- inspect current APIs
- inspect filesystem security
- inspect workspace model
- inspect authentication
- inspect database models
- inspect terminal implementation
- inspect Git implementation
- inspect deployment implementation

Then make the smallest safe architectural changes required.

Do not rewrite the entire application unnecessarily.

Do not delete existing functionality just to implement Connected Projects.

---

# FINAL GOAL

I want the DevPanel to behave like this:

```text
                    DEV PANEL
                        │
              ┌─────────┴─────────┐
              │                   │
         DevPanel UI        Connected Projects
                                  │
                         ┌────────┴────────┐
                         │                 │
                  Diet Ghazipur      Other Website
                         │
                  /var/www/
                  diet-website
                         │
          ┌──────────────┼──────────────┐
          │              │              │
       Editor         Terminal         Git
          │              │              │
          └──────────────┼──────────────┘
                         │
                       Deploy
                         │
                 Build + Restart
                         │
                    LIVE WEBSITE
```

The key requirement is:

**DevPanel is the management panel. Diet Ghazipur is the application being managed.**

When I select Diet Ghazipur, everything must target:

```text
/var/www/diet-website
```

and NEVER the DevPanel's own directory.

Implement this fully, test it, fix all related frontend/backend issues, and provide a concise summary of changed files and how to test the feature.