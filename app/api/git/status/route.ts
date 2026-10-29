import { NextRequest, NextResponse } from 'next/server';
import { secureApiHandler } from '@/lib/api/handler';
import { getGitStatus, initOrCheckGit, getBranches, getCommitHistory } from '@/lib/git/gitClient';

export async function GET(req: NextRequest) {
  return secureApiHandler(
    req,
    async (r) => {
      const { searchParams } = new URL(req.url);
      const workspaceId = searchParams.get('workspaceId') || 'main-website';

      await initOrCheckGit(workspaceId);
      const [status, branches, commits] = await Promise.all([
        getGitStatus(workspaceId),
        getBranches(workspaceId).catch(() => ({ all: ['main'], current: 'main' })),
        getCommitHistory(workspaceId, 15),
      ]);

      return NextResponse.json({
        ...status,
        branches: branches.all,
        recentCommits: commits,
      });
    },
    'git_read'
  );
}

