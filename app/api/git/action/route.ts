import { NextRequest, NextResponse } from 'next/server';
import { secureApiHandler, logAudit, getClientIp } from '@/lib/api/handler';
import {
  stageAll,
  stageFile,
  unstageFile,
  commitChanges,
  gitPull,
  gitPush,
  checkoutBranch,
  getFileDiff,
  cloneRepository,
} from '@/lib/git/gitClient';

export async function POST(req: NextRequest) {
  return secureApiHandler(
    req,
    async (r, user) => {
      const body = await req.json();
      const { workspaceId, action, filePath, message, branchName, createBranch, repoUrl } = body;
      const wsId = workspaceId || 'main-website';
      const ip = getClientIp(req);

      try {
        switch (action) {
          case 'stage':
            if (filePath) {
              await stageFile(wsId, filePath);
            } else {
              await stageAll(wsId);
            }
            return NextResponse.json({ success: true, message: 'Changes staged' });

          case 'unstage':
            if (!filePath) throw new Error('File path required to unstage');
            await unstageFile(wsId, filePath);
            return NextResponse.json({ success: true, message: 'File unstaged' });

          case 'commit':
            if (!message) throw new Error('Commit message is required');
            const commitResult = await commitChanges(wsId, message);
            logAudit(user.email, 'Git Commit', `Committed: "${message}" (${commitResult.commit || ''})`, wsId, ip, 'Success');
            return NextResponse.json({ success: true, commit: commitResult });

          case 'push':
            const pushResult = await gitPush(wsId);
            logAudit(user.email, 'Git Push', `Pushed repository changes to remote`, wsId, ip, 'Success');
            return NextResponse.json({ success: true, pushResult });

          case 'pull':
            const pullResult = await gitPull(wsId);
            logAudit(user.email, 'Git Pull', `Pulled latest changes from remote`, wsId, ip, 'Success');
            return NextResponse.json({ success: true, pullResult });

          case 'branch':
            if (!branchName) throw new Error('Branch name required');
            await checkoutBranch(wsId, branchName, !!createBranch);
            logAudit(
              user.email,
              createBranch ? 'Git Branch Created' : 'Git Branch Checkout',
              `Switched to branch: ${branchName}`,
              wsId,
              ip,
              'Success'
            );
            return NextResponse.json({ success: true, currentBranch: branchName });

          case 'diff':
            const diff = await getFileDiff(wsId, filePath);
            return NextResponse.json({ success: true, diff });

          case 'clone':
            if (!repoUrl) throw new Error('Repository URL required');
            await cloneRepository(wsId, repoUrl, branchName);
            logAudit(user.email, 'Git Clone', `Cloned ${repoUrl}`, wsId, ip, 'Success');
            return NextResponse.json({ success: true });

          default:
            return NextResponse.json({ error: `Unknown git action: ${action}` }, { status: 400 });
        }
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    },
    'git_commit_push'
  );
}

