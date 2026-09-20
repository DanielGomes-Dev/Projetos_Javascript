const cors = require('../middlewares/cors')
const contentType = require('../middlewares/content-type')

const jsonParser = require('../middlewares/json-parser')

module.exports = app => {
    app.disable('x-powered-by')
    app.use(cors)
    app.use(jsonParser)
    app.use(contentType);
}