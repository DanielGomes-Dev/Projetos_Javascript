const { Router } = require('express');
const {
  create_enrollment,
  get_all_enrollments,
  cancel_enrollment
} = require('../controllers/enrollments.controller');

const router = Router();

router.post('/', create_enrollment);
router.get('/', get_all_enrollments);
router.patch('/:id/cancel', cancel_enrollment);

module.exports = router;
