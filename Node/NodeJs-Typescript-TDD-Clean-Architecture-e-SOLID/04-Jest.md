"test": "jest --passWithNoTests --silent",
"test:verbose": "jest --passWithNoTests",

"test:unit": "npm test -- --watch",

"test:stage": "jest --passWithNoTests"

- Rodar apenas specs;

```
const config = require('./jest.config')
config.testMatch = ['**/*.spec.ts']
module.exports = config

```

--findRelatedTests

--runInBand

        "test:ci": "npm test -- --coverage"
