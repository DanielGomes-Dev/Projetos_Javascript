const asyncHandler = require('../utils/asyncHandler');
const studentsService = require('../services/students.service');

const get_all_student = asyncHandler(async (req, res) => {
  const students = await studentsService.listStudents();
  return res.status(200).json(students);
});

const create_student = asyncHandler(async (req, res) => {
  const student = await studentsService.createStudent(req.body);
  return res.status(201).json(student);
});

module.exports = { get_all_student, create_student };
