# Contributing to Screengrid

Use Node.js 22 and npm to match CI. Fork the repository, clone your fork, and create a branch for your change. From the repository root, install the locked dependencies and run the test suite.

```sh
npm ci
npm test
node examples/grammar/smoke-test.mjs
```

`npm test` builds the package before running the unit tests. To check a visual change, run `npm start` and open `http://localhost:8000/examples/`. The examples load MapLibre and basemap assets over the network.

Open a pull request with a short description, the examples or APIs affected, and the checks you ran. For grammar changes, follow the specification and version requirements in [AGENTS.md](AGENTS.md).

For a bug report, include your Screengrid and MapLibre versions, browser or Node.js version, steps to reproduce the issue, and the expected and observed behavior. A small example with synthetic data helps others reproduce the problem. [Report an issue](https://github.com/danylaksono/screengrid/issues/new)

For usage questions, start with the [usage guide](docs/USAGE.md) and [API reference](docs/API_REFERENCE.md). If you still need help, open an issue with the example or API you are using and what you have tried. [Ask for support](https://github.com/danylaksono/screengrid/issues/new)
