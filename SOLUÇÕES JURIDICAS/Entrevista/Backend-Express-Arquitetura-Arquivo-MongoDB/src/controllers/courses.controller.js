const asyncHandler = require('../utils/asyncHandler');
const coursesService = require('../services/courses.service');

const get_all_courses = asyncHandler(async (req, res) => {
  const courses = await coursesService.listCourses();
  return res.status(200).json(courses);
});

module.exports = { get_all_courses };
