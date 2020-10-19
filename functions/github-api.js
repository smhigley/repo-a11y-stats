const fetch = require('node-fetch');
const { AUTH_TOKEN } = process.env;

async function getIssues(owner, repository, repoA11yLabels) {
	const query = `query {
		repository(owner: "${owner}", name: "${repository}") {
			a11yIssues: issues(
				filterBy:{ labels: ${JSON.stringify(repoA11yLabels)} },
				orderBy:{field: CREATED_AT, direction: DESC},
				first:100
			) {
				...issueFields
			}
			issues: issues(
				orderBy:{field: CREATED_AT, direction: DESC},
				first:100
			) {
				...issueFields
			}
		}
	}
	fragment issueFields on IssueConnection {
		edges {
			node {
				closedAt
				createdAt
				number
				state
				title
				url
				firstComment: comments(first: 1) {
					nodes {
						createdAt
					}
				}
				comments {
					totalCount
				}
				labels(first:5) {
					nodes {
						name
					}
				}
				timelineItems(itemTypes:CLOSED_EVENT, last: 1) {
					nodes {
						...on ClosedEvent {
							closer {
								...on PullRequest {
									title
									closedAt
								}
							}
						}
					}
				}
			}
		}
	}`;


  const url = 'https://api.github.com/graphql';
  
  console.log('calling github api with token', AUTH_TOKEN);

	const data = fetch(url, {
		method: 'POST',
		headers: {
			'Accept': 'application/vnd.github.v4.idl',
			'Authorization': `token ${AUTH_TOKEN}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ query })
	})
	.then((response) => response.json())
	.catch((error) => {
		console.warn(error);
		return { error };
	});

	return data;
}

exports.handler = async function(event, context, callback) {
  console.log('api fn called with event', event, event.queryStringParameters);
  
  const { owner, repository, a11yLabels } = event.queryStringParameters;
  const data = await getIssues(owner, repository, a11yLabels);

  if (data.error) {
    callback(null, {
      headers: {
        "Access-Control-Allow-Origin": "*"
      },
      statusCode: 500,
      body: JSON.stringify(data)
    });
  }
  else {
    callback(null, {
      headers: {
        "Access-Control-Allow-Origin": "*"
      },
      statusCode: 200,
      body: JSON.stringify(data)
    });
  }
};