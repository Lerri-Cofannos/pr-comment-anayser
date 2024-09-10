import { Octokit } from 'octokit';
import fs from 'fs';
import { Parser } from 'json2csv';

const REPO_OWNER = 'qare'; // owner of the repo
const REPO_NAME = 'api'; // name of the repo
const LABEL = 'guidelines'; // label to filter pull requests
const PAGE_SIZE = 100; // number of pull requests to fetch
const PAGE_NUMBER = 2; // page number to fetch
const OUTPUT_CSV = `pr_comments_p${PAGE_NUMBER}.csv`; // output file name

const REPO_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
const octokit = new Octokit({
  auth: process.env.TOKEN,
});

export async function getPullRequests() {
  const url = `${REPO_URL}/pulls?state=closed&per_page=${PAGE_SIZE}&page=${PAGE_NUMBER}`;
  const response = await octokit.request(url, {
    owner: REPO_OWNER,
    repo: REPO_NAME,
  });
  return response.data;
}

function filterPRs(prs) {
  const filteredPRs = prs.filter((pr) =>
    pr.labels.some((label) => label.name === LABEL),
  );
  console.log(`Total PRs with label ${LABEL}:`, filteredPRs.length);
  return filteredPRs;
}

async function getPRComments(prNumber) {
  const url = `${REPO_URL}/pulls/${prNumber}/comments`;
  const response = await octokit.request(url, {
    owner: REPO_OWNER,
    repo: REPO_NAME,
  });
  return response.data;
}

function formatCommentBody(commentBody) {
  return commentBody
    .replace(/(\r\n|\r|\n)/g, ' ')
    .replace(/,/g, ';')
    .trim();
}

export async function extractComments(prs) {
  const comments = [];
  for (const pr of prs) {
    const prComments = await getPRComments(pr.number);
    for (const comment of prComments) {
      comments.push({
        prTitle: pr.title,
        prUrl: pr.html_url,
        prLabels: pr.labels.map((label) => label.name).join(', '),
        prCreationDate: pr.created_at,
        prMergeDate: pr.merged_at,
        prAssignee: pr.assignee?.login || pr.user.login,
        reviewer: comment.user?.login || 'N/A',
        commentBody: formatCommentBody(comment.body),
        filePath: comment.path || 'N/A',
      });
    }
  }
  console.log('Total comments extracted:', comments.length);
  return comments;
}

export async function processPRs() {
  try {
    const pullRequests = await getPullRequests();
    console.log('Total PRs fetched:', pullRequests.length);
    const filteredPRs = await filterPRs(pullRequests);
    const comments = await extractComments(filteredPRs);

    // Convert JSON to CSV
    const parser = new Parser({
      fields: [
        'prTitle',
        'prLabels',
        'prUrl',
        'prCreationDate',
        'prMergeDate',
        'prAssignee',
        'reviewer',
        'commentBody',
        'filePath',
      ],
    });
    const csv = parser.parse(comments);

    // Save CSV to file
    fs.writeFileSync(OUTPUT_CSV, csv);
    console.log(`CSV file saved in ${OUTPUT_CSV}`);
  } catch (error) {
    console.error(
      'Error fetching PR comments:',
      error.response || error.message,
    );
  }
}
