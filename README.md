# Blockchain Battle

An HTML5 game about cryptocurrency and the blockchain.

Created by Play Curious, with support from Science Animation, France IOI, and the Blaise Pascal Foundation.

Developed using the [https://github.com/play-curious/booyah](Booyah game engine).

## Development

1. Install dependencies:

- npm and gulp-cli if you don't have them.
- `npm install`

2. Clone or download https://github.com/play-curious/booyah into a sub-directory as `booyah`
3. Use `gulp dist` to create a minified version, useful for deployment.

### Building Electron app

To build Windows on Mac, getting around 64- 32-bit compatibility issues, use Docker as a solution.

https://pilsniak.com/how-to-install-docker-on-mac-os-using-brew/
https://github.com/electron-userland/electron-builder/issues/4305

```
docker run --rm -ti \
 --env-file <(env | grep -iE 'DEBUG|NODE_|ELECTRON_|YARN_|NPM_|CI|CIRCLE|TRAVIS_TAG|TRAVIS|TRAVIS_REPO_|TRAVIS_BUILD_|TRAVIS_BRANCH|TRAVIS_PULL_REQUEST_|APPVEYOR_|CSC_|GH_|GITHUB_|BT_|AWS_|STRIP|BUILD_') \
 --env ELECTRON_CACHE="/root/.cache/electron" \
 --env ELECTRON_BUILDER_CACHE="/root/.cache/electron-builder" \
 -v ${PWD}:/project \
 -v ${PWD##*/}-node-modules:/project/node_modules \
 -v ~/.cache/electron:/root/.cache/electron \
 -v ~/.cache/electron-builder:/root/.cache/electron-builder \
 electronuserland/builder:wine
```

## Licensing

Blockchain Battle is open source, under the GPL v3 license.

## Copyright

Copyright 2019 by Play Curious.
