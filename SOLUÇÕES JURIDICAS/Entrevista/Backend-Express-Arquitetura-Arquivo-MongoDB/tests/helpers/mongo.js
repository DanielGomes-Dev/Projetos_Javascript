const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const Student = require('../../src/models/Student');
const Course = require('../../src/models/Course');
const Enrollment = require('../../src/models/Enrollment');

let mongoServer;

async function connectTestDatabase() {
  mongoServer = await MongoMemoryServer.create({
    binary: {
      version: process.env.MONGOMS_VERSION || '7.0.14'
    }
  });

  await mongoose.connect(mongoServer.getUri());
  await Promise.all([Student.init(), Course.init(), Enrollment.init()]);
}

async function clearTestDatabase() {
  if (mongoose.connection.readyState !== 1) return;

  await Promise.all(
    Object.values(mongoose.connection.collections)
      .map(collection => collection.deleteMany({}))
  );
}

async function disconnectTestDatabase() {
  await mongoose.disconnect();

  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = undefined;
  }
}

module.exports = {
  connectTestDatabase,
  clearTestDatabase,
  disconnectTestDatabase
};
