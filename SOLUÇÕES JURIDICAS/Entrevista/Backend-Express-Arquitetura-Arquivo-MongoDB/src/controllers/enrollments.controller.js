const asyncHandler = require('../utils/asyncHandler');
const enrollmentsService = require('../services/enrollments.service');

const create_enrollment = asyncHandler(async (req, res) => {
  const matricula = await enrollmentsService.createEnrollment(req.body);
  return res.status(201).json(matricula);
});

const get_all_enrollments = asyncHandler(async (req, res) => {
  const matriculas = await enrollmentsService.listEnrollments(req.query);
  return res.status(200).json(matriculas);
});

const cancel_enrollment = asyncHandler(async (req, res) => {
  const matricula = await enrollmentsService.cancelEnrollment(req.params.id);
  return res.status(200).json(matricula);
});

module.exports = { create_enrollment, get_all_enrollments, cancel_enrollment };
