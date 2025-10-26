const { MongoClient } = require('mongodb');
require('dotenv').config();

const client = new MongoClient(process.env.MONGO_URI);

async function connectDB() {
  try {
    await client.connect();
    console.log(' Connected to QuickLook database');

    const db = client.db('QuickLook');

    // Make collections globally accessible
    global.JobSeekerDetails = db.collection('JobSeekerDetails');
    global.Applications = db.collection('Applications');
    global.PostedJobs = db.collection('PostedJobs');
    global.EmployerDetails = db.collection('employerDetails');
    global.Notifications = db.collection('notifications');

  } catch (err) {
    console.error(' MongoDB connection error:', err);
  }
}

module.exports = { connectDB };