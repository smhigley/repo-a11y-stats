# Repository A11y Stats

A small app that uses the github API to grab information about issues and labels, and looks at a11y-focused activity.

To run locally, first install node modules:

```js
npm install
```

Next create a `.env` file to hold your [github API token](https://docs.github.com/en/free-pro-team@latest/github/authenticating-to-github/creating-a-personal-access-token), and add the following environment variable:

```js
AUTH_TOKEN=your_auth_token_string
```

Finally, run:

```js
npm run dev
```