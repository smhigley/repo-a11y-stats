// save reference to results container element
const resultsEl = document.querySelector('.results');

// list of keywords that could indicate an issue is realted to accessibility:
const a11yKeywords = ['a11y', 'accessibility', 'aria', 'jaws', 'nvda', 'voiceover', 'narrator', 'talkback', 'zoomtext', 'screen reader', 'screenreader', 'assistive tech'];

// Fetch wrapper for github endpoints
async function fetchRepoLabels(owner, repository) {
	const params = new URLSearchParams({
		per_page: 100
	});
	const url = `https://api.github.com/repos/${owner}/${repository}/labels?${params}`;

	const data = fetch(url, {
			method: 'GET',
			headers: {
				'Accept': 'application/vnd.github.v3+json'
			}
		})
		.then((response) => response.json())
		.catch((error) => {
			console.warn(error);
			return [];
		});
	
	return data;
}

async function getLabels(owner, repository) {
	if (!owner || !repository) {
		console.warn('Please enter github owner and repository name information');
		return;
	}
	
	// display loading message
	updateLoading(true);

	// get repo label data
	const labels = await fetchRepoLabels(owner, repository);

	// filter by keywords
	const a11yLabels = labels.filter((label) => {
		const name = label.name.toLowerCase();

		for (let keyword of a11yKeywords) {
			if (name.includes(keyword)) {
				return true;
			}
		}

		return false;
	});

	updateLoading(false);
	resultsEl.classList.remove('initial');
	resultsEl.classList.add('labels');
	const labelNames = a11yLabels.map((label) => label.name);
	renderLabelList('#label-output', a11yLabels);
	resultsEl.classList.add('labels');
	return labelNames;
}

function renderLabelList(selector, results = []) {
	const resultNode = selector && document.querySelector(selector);
	// if no DOM node is found, don't bother
	if (!resultNode) {
		return;
	}

	const listEl = document.createElement('ul');
	listEl.classList.add('results-list');

	for (let result of results) {
		const url = result.url.replace('https://api.github.com/repos/', 'https://github.com/');
		// create each line
		const line = document.createElement('li');
		line.innerHTML = `
			<a href="${url}">
				<span class="swatch" style="background:#${result.color};"></span>
				${result.name}
			</a>`;

		// Append each li to the ul
		listEl.appendChild(line);
	}

	resultNode.innerHTML = '';
	resultNode.appendChild(listEl);
}

function renderResults(selector, results) {
	const resultNode = selector && document.querySelector(selector);
	// if no DOM node is found, don't bother
	if (!resultNode) {
		return;
	}

	const { all, a11yIssues } = results;

	resultNode.innerHTML = `
		<p>Percent of accessibility bugs in last 100 issues: ${results.all.a11yCount}%</p>
		<table>
			<thead>
				<tr>
					<th></th>
					<th>All Issues</th>
					<th>A11y Issues</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<th scope="row">% Resolved with PR</th>
					<td>${Math.round(all.resolveRate)}%</td>
					<td>${Math.round(a11yIssues.resolveRate)}%</td>
				</tr>
				<tr>
					<th scope="row">Average # comments</th>
					<td>${Math.round(all.avgCommentCount)}</td>
					<td>${Math.round(a11yIssues.avgCommentCount)}</td>
				</tr>
				<tr>
					<th scope="row">Average time to close</th>
					<td>${all.avgTimeToClose}</td>
					<td>${a11yIssues.avgTimeToClose}</td>
				</tr>
				<tr>
					<th scope="row">Average time to 1st comment</th>
					<td>${all.avgTimeToComment}</td>
					<td>${a11yIssues.avgTimeToComment}</td>
				</tr>
			</tbody>
		</table>
	`;
}

async function getIssues(owner, repository, a11yLabels) {
	const params = new URLSearchParams({ owner, repository, a11yLabels });
	const url = `/.netlify/functions/github-api?${params}`;

	const data = fetch(url, { method: 'GET' })
		.then((response) => response.json())
		.catch((err) => {
			console.log('netlify error:', err);
		});

	return data;
}

async function analyzeIssues(owner, repo, repoA11yLabels) {
	const response = await getIssues(owner, repo, repoA11yLabels);
	console.log("data returned from netlify:", response);

	const issues = response.data.repository.issues.edges.map((issue) => issue.node);
	const a11yIssues = response.data.repository.a11yIssues.edges.map((issue) => issue.node);
	console.log('issues:', issues);
	console.log('a11yissues', a11yIssues);

	const results = {
		all: {
			count: 0,
			a11yCount: 0,
			commentCount: [],
			resolvedCount: 0,
			timeToClose: [],
			timeToComment: []
		},
		a11yIssues: {
			count: 0,
			commentCount: [],
			resolvedCount: 0,
			timeToClose: [],
			timeToComment: []
		}
	}

	const pushIssueData = (issue, bucket) => {
		const {commentCount, isResolved, timeToClose, timeToComment} = getIssueDetails(issue);

		bucket.count++;
		bucket.commentCount.push(commentCount);
		isResolved && bucket.resolvedCount++;
		timeToClose && bucket.timeToClose.push(timeToClose);
		timeToComment && bucket.timeToComment.push(timeToComment);
	}

	issues.forEach((issue) => {
		pushIssueData(issue, results.all);

		// use our special a11y checker (that includes title keywords) to check how many issues in the latest 100 are a11y issues
		if (checkA11yIssue(issue ,repoA11yLabels)) {
			results.all.a11yCount++;
		}
	});
	a11yIssues.forEach((issue) => {
		pushIssueData(issue, results.a11yIssues);
	});

	const average = (array) => array.reduce((a, b) => a + b, 0) / array.length;
	const timeFromMS = (ms) => {
		const hourCount = Math.round(ms / 3600000);

		if (hourCount < 24) {
			return `${hourCount} hours`;
		}

		const days = Math.floor(hourCount / 24);
		const hours = hourCount % 24;
		return `${days} days, ${hours} hours`;
	}
	
	results.all = {
		...results.all,
		avgCommentCount: average(results.all.commentCount),
		avgTimeToClose: timeFromMS(average(results.all.timeToClose)),
		avgTimeToComment: timeFromMS(average(results.all.timeToComment)),
		resolveRate: (results.all.resolvedCount / results.all.count) * 100
	};
	results.a11yIssues = {
		...results.a11yIssues,
		avgCommentCount: average(results.a11yIssues.commentCount),
		avgTimeToClose: timeFromMS(average(results.a11yIssues.timeToClose)),
		avgTimeToComment: timeFromMS(average(results.a11yIssues.timeToComment)),
		resolveRate: (results.a11yIssues.resolvedCount / results.a11yIssues.count) * 100
	};

	return results;
}

function getIssueDetails(issue) {
	const issuePR = issue.timelineItems.nodes.length ? issue.timelineItems.nodes[0].closer : null;
	const commentDate = issue.firstComment.nodes.length ? issue.firstComment.nodes[0].createdAt : null;

	const commentCount = issue.comments.totalCount;
	const isResolved = !!issuePR;
	const timeToClose = issue.state === 'CLOSED' ? (new Date(issue.closedAt) - new Date(issue.createdAt)) : null;
	const timeToComment = commentDate ? (new Date(commentDate) - new Date(issue.createdAt)) : null;

	return {
		commentCount,
		isResolved,
		timeToClose,
		timeToComment
	};
}

/* Check if a specific issue is accessibility-related by looking at labels and title */
function checkA11yIssue(issue, repoA11yLabels) {
	// first check if any of the repository's accessibility labels are applied
	const issueLabels = issue.labels.nodes.map((label) => label.name);
	const issueA11yLabels = issueLabels.filter((label) => repoA11yLabels.includes(label));

	if (issueA11yLabels.length > 0) {
		return true;
	}

	// check if any of the a11y keywords exist in the issue title
	const issueTitle = issue.title.toLowerCase();
	for (let keyword of a11yKeywords) {
		if (issueTitle.includes(keyword)) {
			return true;
		}
	}

	return false;
}

/* Handle loading state */
function updateLoading(loading) {
	const classFunction = loading ? 'add' : 'remove';
	const loadingEl = document.querySelector('.loading-status');

	resultsEl.classList[classFunction]('loading');

	if (loading) {
		loadingEl.innerHTML = 'Loading...';
	}
	else {
		loadingEl.innerHTML = '';
	}
}

/*
 * Hook up DOM events
 */

const form = document.getElementById('repoInfo');
let repoA11yLabels = [];
let owner, repository;

form.addEventListener('submit', async (event) => {
    event.preventDefault();

		owner = document.getElementById('owner').value;
		repository = document.getElementById('repository').value;

		repoA11yLabels = await getLabels(owner, repository);
});

const testBtn = document.getElementById('graph-test');
testBtn.addEventListener('click', async () => {
	updateLoading(true);
	const results = await analyzeIssues(owner, repository, repoA11yLabels);
	renderResults('#graph-results', results);
	updateLoading(false);
	resultsEl.classList.remove('labels');
});