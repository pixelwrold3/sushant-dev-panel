import { NextRequest, NextResponse } from 'next/server';
import { secureApiHandler, logAudit, getClientIp } from '@/lib/api/handler';
import {
  stageAll,
  stageFile,
  unstageFile,
  commitChanges,
  gitPull,
  gitUndoPull,
  gitRedoPull,
  setRemoteUrl,
  getPullHistory,
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
      const {
        projectId,
        workspaceId,
        action,
        filePath,
        message,
        branchName,
        createBranch,
        repoUrl,
        protectEnv,
        pullId,
        targetCommit,
      } = body;
      const targetId = projectId || workspaceId || 'diet-ghazipur';
      const ip = getClientIp(req);

      try {
        switch (action) {
          case 'stage':
            if (filePath) {
              await stageFile(targetId, filePath);
            } else {
              await stageAll(targetId);
            }
            return NextResponse.json({ success: true, message: 'Changes staged' });

          case 'unstage':
            if (!filePath) throw new Error('File path required to unstage');
            await unstageFile(targetId, filePath);
            return NextResponse.json({ success: true, message: 'File unstaged' });

          case 'commit':
            if (!message) throw new Error('Commit message is required');
            const commitResult = await commitChanges(targetId, message);
            logAudit(user.email, 'Git Commit', `Committed: "${message}" (${commitResult.commit || ''})`, targetId, ip, 'Success');
            return NextResponse.json({ success: true, commit: commitResult });

          case 'push':
            const pushResult = await gitPush(targetId);
            logAudit(user.email, 'Git Push', `Pushed repository changes to remote`, targetId, ip, 'Success');
            return NextResponse.json({ success: true, pushResult });

          case 'pull':
            const pullResult = await gitPull(targetId, {
              protectEnv: protectEnv !== false,
              user: user.email,
            });
            logAudit(
              user.email,
              'Git Pull',
              `Pulled changes into ${targetId} (Pre: ${pullResult.preCommit} -> Post: ${pullResult.postCommit}, envProtected: ${pullResult.envProtected})`,
              targetId,
              ip,
              'Success'
            );
            return NextResponse.json({ success: true, pullResult });

          case 'undo_pull':
            const undoResult = await gitUndoPull(targetId, pullId, targetCommit);
            logAudit(
              user.email,
              'Git Pull Undone',
              `Reverted pull on ${targetId} back to commit ${undoResult.revertedTo}`,
              targetId,
              ip,
              'Warning'
            );
            return NextResponse.json({ success: true, undoResult });

          case 'redo_pull':
            if (!pullId) throw new Error('pullId is required to re-apply / redo pull');
            const redoResult = await gitRedoPull(targetId, pullId);
            logAudit(
              user.email,
              'Git Pull Re-applied',
              `Re-applied pull on ${targetId} back to commit ${redoResult.reloadedTo}`,
              targetId,
              ip,
              'Success'
            );
            return NextResponse.json({ success: true, redoResult });

          case 'set_repo_url':
            if (!repoUrl) throw new Error('repoUrl is required');
            const repoResult = await setRemoteUrl(targetId, repoUrl);
            logAudit(
              user.email,
              'Git Remote URL Set',
              `Updated git remote repository URL for ${targetId} to ${repoUrl}`,
              targetId,
              ip,
              'Success'
            );
            return NextResponse.json({ success: true, repoResult });

          case 'pull_history':
            const history = getPullHistory(targetId);
            return NextResponse.json({ success: true, history });

          case 'branch':
            if (!branchName) throw new Error('Branch name required');
            await checkoutBranch(targetId, branchName, !!createBranch);
            logAudit(
              user.email,
              createBranch ? 'Git Branch Created' : 'Git Branch Checkout',
              `Switched to branch: ${branchName}`,
              targetId,
              ip,
              'Success'
            );
            return NextResponse.json({ success: true, currentBranch: branchName });

          case 'diff':
            const diff = await getFileDiff(targetId, filePath);
            return NextResponse.json({ success: true, diff });

          case 'clone':
            if (!repoUrl) throw new Error('Repository URL required');
            await cloneRepository(targetId, repoUrl, branchName);
            logAudit(user.email, 'Git Clone', `Cloned ${repoUrl}`, targetId, ip, 'Success');
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
