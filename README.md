# Meta-DAO Frontend

![License BSLv1.1](https://img.shields.io/badge/License-BSLv1.1-lightgray.svg)

The most popular frontend for the Meta-DAO.

## npm scripts

### Localnet setup

1. `git clone https://github.com/metaDAOproject/meta-dao`
2. `cd meta-dao`
3. `npm install`
4. `anchor localnet`

See Meta-DAO's repo for more details.

### Build and dev scripts

- `dev` – start dev server
- `build` – bundle application for production
- `analyze` – analyzes application bundle with [@next/bundle-analyzer](https://www.npmjs.com/package/@next/bundle-analyzer)

### Testing scripts

- `typecheck` – checks TypeScript types
- `lint` – runs ESLint
- `prettier:check` – checks files with Prettier
- `jest` – runs jest tests
- `jest:watch` – starts jest watch
- `test` – runs `jest`, `prettier:check`, `lint` and `typecheck` scripts

### Other scripts

- `storybook` – starts storybook dev server
- `storybook:build` – build production storybook bundle to `storybook-static`
- `prettier:write` – formats all files with Prettier

## Contributing

You can find instructions and guidelines on how to contribute in [CONTRIBUTING.md](/CONTRIBUTING.md)

## Using custom Swap API endpoints

You can get Swap API urls from [Jupiter Station](https://station.jup.ag/docs/apis/swap-api), [QuickNode](https://marketplace.quicknode.com/add-on/metis-jupiter-v6-swap-api) or [JupiterAPI.com](https://www.jupiterapi.com/). You can adjust the `basePath` for `createJupiterApiClient` to your preference.