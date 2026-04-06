/**
 * GitHub Integration Routes
 * Endpoints for GitHub operations via ELIXI
 */

import { Router, Request, Response } from 'express';
import { integrationService } from '../services/integration.service';
import { createGitHubService } from '../services/github.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Helper function to get GitHub service with token
 */
async function getGitHubService(integrationId: string) {
  const token = await integrationService.getAccessToken(integrationId);
  if (!token) {
    throw new Error('GitHub integration token not found');
  }
  return createGitHubService(token);
}

/**
 * GET /api/integrations/github/:integrationId/repos
 * List GitHub repositories
 */
router.get('/:integrationId/repos', async (req: Request, res: Response) => {
  try {
    const github = await getGitHubService(req.params.integrationId);
    const repos = await github.listRepositories();
    res.json({ repositories: repos });
  } catch (error) {
    logger.error('Failed to list GitHub repositories', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to list repositories',
    });
  }
});

/**
 * GET /api/integrations/github/:integrationId/user
 * Get authenticated user information
 */
router.get('/:integrationId/user', async (req: Request, res: Response) => {
  try {
    const github = await getGitHubService(req.params.integrationId);
    const user = await github.getUser();
    res.json({ user });
  } catch (error) {
    logger.error('Failed to get GitHub user', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get user',
    });
  }
});

/**
 * GET /api/integrations/github/:integrationId/repos/:owner/:repo/issues
 * List issues in a repository
 */
router.get('/:integrationId/repos/:owner/:repo/issues', async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;
    const state = (req.query.state as 'open' | 'closed' | 'all') || 'open';

    const github = await getGitHubService(req.params.integrationId);
    const issues = await github.listIssues(owner, repo, { state });

    res.json({ issues });
  } catch (error) {
    logger.error('Failed to list GitHub issues', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to list issues',
    });
  }
});

/**
 * POST /api/integrations/github/:integrationId/repos/:owner/:repo/issues
 * Create a new issue
 */
router.post('/:integrationId/repos/:owner/:repo/issues', async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;
    const { title, body } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const github = await getGitHubService(req.params.integrationId);
    const issue = await github.createIssue(owner, repo, title, body || '');

    res.json({ issue });
  } catch (error) {
    logger.error('Failed to create GitHub issue', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create issue',
    });
  }
});

/**
 * GET /api/integrations/github/:integrationId/repos/:owner/:repo/pulls
 * List pull requests
 */
router.get('/:integrationId/repos/:owner/:repo/pulls', async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;
    const state = (req.query.state as 'open' | 'closed' | 'all') || 'open';

    const github = await getGitHubService(req.params.integrationId);
    const prs = await github.listPullRequests(owner, repo, { state });

    res.json({ pullRequests: prs });
  } catch (error) {
    logger.error('Failed to list GitHub pull requests', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to list pull requests',
    });
  }
});

/**
 * GET /api/integrations/github/:integrationId/repos/:owner/:repo/commits
 * List commits
 */
router.get('/:integrationId/repos/:owner/:repo/commits', async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;

    const github = await getGitHubService(req.params.integrationId);
    const commits = await github.listCommits(owner, repo);

    res.json({ commits });
  } catch (error) {
    logger.error('Failed to list GitHub commits', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to list commits',
    });
  }
});

/**
 * GET /api/integrations/github/:integrationId/rate-limit
 * Get GitHub rate limit information
 */
router.get('/:integrationId/rate-limit', async (req: Request, res: Response) => {
  try {
    const github = await getGitHubService(req.params.integrationId);
    const rateLimit = await github.getRateLimit();

    res.json({ rateLimit });
  } catch (error) {
    logger.error('Failed to get GitHub rate limit', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get rate limit',
    });
  }
});

export { router as githubIntegrationRouter };
