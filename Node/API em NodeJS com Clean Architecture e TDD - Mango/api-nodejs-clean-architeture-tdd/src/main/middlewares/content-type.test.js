const request = require('supertest')
    // const app = require('../config/app')

describe('content-type middleware', () => {
    let app;

    beforeEach(() => {
        jest.resetModules()
        app = require('../config/app')

    })

    test('should return json content type as default', async() => {
        app.get('/content-type', (req, res) => {
            res.send({})
        })

        const res = await request(app).get('/content-type')
            .expect('content-type', /json/)

    });

    test('should return xml content type af forced', async() => {
        app.get('/content-type', (req, res) => {
            res.type('xml')
            res.send({})
        })

        const res = await request(app).get('/content-type')
            .expect('content-type', /xml/)

    });

    test('should return xml content type af forced', async() => {
        app.get('/content-type-xml', (req, res) => {
            res.type('xml')
            res.send({})
        })

        const res = await request(app).get('/content-type-xml')
            .expect('content-type', /xml/)

    });
});