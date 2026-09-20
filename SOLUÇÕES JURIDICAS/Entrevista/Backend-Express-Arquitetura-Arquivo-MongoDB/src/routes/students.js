const { Router } = require('express');
const { get_all_student, create_student } = require('../controllers/student.controller');

const router = Router();

router.get('/', get_all_student);
router.post('/', create_student);

module.exports = router;
