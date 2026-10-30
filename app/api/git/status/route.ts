import { NextRequest, NextResponse } from 'next/server';
import { secureApiHandler } from '@/lib/api/handler';
import { getGitStatus, initOrCheckGit, getBranches, getCommitHistory } from '@/lib/git/gitClient';

export async function GET(req: NextRequest) {
  return secureApiHandler(
    req,
    async (r) => {
      const { searchParams } = new URL(req.url);
      const projectId = searchParams.get('projectId') || searchParams.get('workspaceId') || 'diet-ghazipur';

      await initOrCheckGit(projectId);
      const [status, branches, commits] = await Promise.all([
        getGitStatus(projectId),
        getBranches(projectId).catch(() => ({ all: ['main'], current: 'main' })),
        getCommitHistory(projectId, 15),
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
