const Course = require('../models/Course');

async function listCourses() {
  return Course.find().sort({ createdAt: 1 });
}

module.exports = { listCourses };
