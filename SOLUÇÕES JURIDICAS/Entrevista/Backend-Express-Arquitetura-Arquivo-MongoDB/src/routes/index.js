const { Router } = require('express');

const studentsRoutes = require('./students');
const coursesRoutes = require('./courses');
const enrollmentsRoutes = require('./enrollments');

const router = Router();

router.use('/students', studentsRoutes);
router.use('/courses', coursesRoutes);
router.use('/enrollments', enrollmentsRoutes);

module.exports = router;
