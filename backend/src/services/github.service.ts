/**
 * GitHub Integration Service
 * Handles interaction with GitHub API
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string;
  url: string;
  private: boolean;
  owner: {
    login: string;
    avatar_url: string;
  };
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  user: {
    login: string;
  };
  created_at: string;
  updated_at: string;
  html_url: string;
}

export interface GitHubPR extends GitHubIssue {
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
  };
  merged: boolean;
  merged_at?: string;
}

export class GitHubIntegrationService {
  private client: AxiosInstance;
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
    this.client = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        'Authorization': `token ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });
  }

  /**
   * Get authenticated user information
   */
  async getUser(): Promise<any> {
    try {
      const response = await this.client.get('/user');
      return response.data;
    } catch (error) {
      logger.error('Failed to get GitHub user', error);
      throw new Error('Failed to get GitHub user');
    }
  }

  /**
   * List user repositories
   */
  async listRepositories(options?: { per_page?: number; page?: number }): Promise<GitHubRepository[]> {
    try {
      const response = await this.client.get('/user/repos', {
        params: {
          per_page: options?.per_page || 30,
          page: options?.page || 1,
          sort: 'updated',
          direction: 'desc',
        },
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to list GitHub repositories', error);
      throw new Error('Failed to list GitHub repositories');
    }
  }

  /**
   * Get specific repository
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    try {
      const response = await this.client.get(`/repos/${owner}/${repo}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get GitHub repository: ${owner}/${repo}`, error);
      throw new Error('Failed to get GitHub repository');
    }
  }

  /**
   * List issues in a repository
   */
  async listIssues(
    owner: string,
    repo: string,
    options?: { state?: 'open' | 'closed' | 'all'; per_page?: number }
  ): Promise<GitHubIssue[]> {
    try {
      const response = await this.client.get(`/repos/${owner}/${repo}/issues`, {
        params: {
          state: options?.state || 'open',
          per_page: options?.per_page || 30,
        },
      });
      return response.data;
    } catch (error) {
      logger.error(`Failed to list GitHub issues for ${owner}/${repo}`, error);
      throw new Error('Failed to list GitHub issues');
    }
  }

  /**
   * Create an issue
   */
  async createIssue(
    owner: string,
    repo: string,
    title: string,
    body: string
  ): Promise<GitHubIssue> {
    try {
      const response = await this.client.post(
        `/repos/${owner}/${repo}/issues`,
        {
          title,
          body,
        }
      );
      logger.info(`Created GitHub issue: ${owner}/${repo}#${response.data.number}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to create GitHub issue in ${owner}/${repo}`, error);
      throw new Error('Failed to create GitHub issue');
    }
  }

  /**
   * Get specific issue
   */
  async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
    try {
      const response = await this.client.get(
        `/repos/${owner}/${repo}/issues/${issueNumber}`
      );
      return response.data;
    } catch (error) {
      logger.error(`Failed to get GitHub issue: ${owner}/${repo}#${issueNumber}`, error);
      throw new Error('Failed to get GitHub issue');
    }
  }

  /**
   * Update an issue
   */
  async updateIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    updates: { title?: string; body?: string; state?: 'open' | 'closed' }
  ): Promise<GitHubIssue> {
    try {
      const response = await this.client.patch(
        `/repos/${owner}/${repo}/issues/${issueNumber}`,
        updates
      );
      logger.info(`Updated GitHub issue: ${owner}/${repo}#${issueNumber}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to update GitHub issue: ${owner}/${repo}#${issueNumber}`, error);
      throw new Error('Failed to update GitHub issue');
    }
  }

  /**
   * List pull requests
   */
  async listPullRequests(
    owner: string,
    repo: string,
    options?: { state?: 'open' | 'closed' | 'all'; per_page?: number }
  ): Promise<GitHubPR[]> {
    try {
      const response = await this.client.get(`/repos/${owner}/${repo}/pulls`, {
        params: {
          state: options?.state || 'open',
          per_page: options?.per_page || 30,
        },
      });
      return response.data;
    } catch (error) {
      logger.error(`Failed to list GitHub pull requests for ${owner}/${repo}`, error);
      throw new Error('Failed to list GitHub pull requests');
    }
  }

  /**
   * Get specific pull request
   */
  async getPullRequest(owner: string, repo: string, prNumber: number): Promise<GitHubPR> {
    try {
      const response = await this.client.get(
        `/repos/${owner}/${repo}/pulls/${prNumber}`
      );
      return response.data;
    } catch (error) {
      logger.error(`Failed to get GitHub PR: ${owner}/${repo}#${prNumber}`, error);
      throw new Error('Failed to get GitHub pull request');
    }
  }

  /**
   * Merge a pull request
   */
  async mergePullRequest(
    owner: string,
    repo: string,
    prNumber: number,
    commitMessage?: string
  ): Promise<{ sha: string; merged: boolean; message: string }> {
    try {
      const response = await this.client.put(
        `/repos/${owner}/${repo}/pulls/${prNumber}/merge`,
        {
          commit_message: commitMessage,
          merge_method: 'squash',
        }
      );
      logger.info(`Merged GitHub PR: ${owner}/${repo}#${prNumber}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to merge GitHub PR: ${owner}/${repo}#${prNumber}`, error);
      throw new Error('Failed to merge GitHub pull request');
    }
  }

  /**
   * List commits
   */
  async listCommits(
    owner: string,
    repo: string,
    options?: { per_page?: number; page?: number }
  ): Promise<any[]> {
    try {
      const response = await this.client.get(
        `/repos/${owner}/${repo}/commits`,
        {
          params: {
            per_page: options?.per_page || 30,
            page: options?.page || 1,
          },
        }
      );
      return response.data;
    } catch (error) {
      logger.error(`Failed to list commits for ${owner}/${repo}`, error);
      throw new Error('Failed to list commits');
    }
  }

  /**
   * Get repository README
   */
  async getReadme(owner: string, repo: string): Promise<{ content: string; encoding: string }> {
    try {
      const response = await this.client.get(
        `/repos/${owner}/${repo}/readme`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3.raw',
          },
        }
      );
      return {
        content: response.data,
        encoding: 'utf-8',
      };
    } catch (error) {
      logger.warn(`Failed to get README for ${owner}/${repo}`);
      return { content: '', encoding: 'utf-8' };
    }
  }

  /**
   * Check rate limits
   */
  async getRateLimit(): Promise<{ remaining: number; limit: number; reset: number }> {
    try {
      const response = await this.client.get('/rate_limit');
      const core = response.data.rate_limit.core;
      return {
        remaining: core.remaining,
        limit: core.limit,
        reset: core.reset,
      };
    } catch (error) {
      logger.error('Failed to get GitHub rate limit', error);
      throw new Error('Failed to get GitHub rate limit');
    }
  }
}

export function createGitHubService(accessToken: string): GitHubIntegrationService {
  return new GitHubIntegrationService(accessToken);
}
