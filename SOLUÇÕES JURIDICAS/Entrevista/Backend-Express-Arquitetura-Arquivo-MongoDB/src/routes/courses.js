const { Router } = require('express');
const { get_all_courses } = require('../controllers/courses.controller');

const router = Router();

router.get('/', get_all_courses);

module.exports = router;
