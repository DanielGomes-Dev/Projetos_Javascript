const request = require('supertest')
const app = require('../config/app')

describe('jsonparse middleware', () => {

    test('should parse body as json enable cors', async() => {
        app.post('/test_json_parse', (req, res) => {
            res.send(req.body)
        })

        const res = await request(app)
            .post('/test_json_parse')
            .send({ name: 'Daniel' })
            .expect({ name: 'Daniel' })


    });
});