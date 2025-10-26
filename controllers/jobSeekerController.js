const { MongoClient } = require('mongodb');
const axios = require('axios'); // ✅ ADDED: Needed for geocoding
const nodemailer = require('nodemailer');

const client = new MongoClient(process.env.MONGO_URI);
const bcrypt = require('bcrypt')
//variable for storing database Name
const dbOfQuickLook = 'QuickLook'
async function connectDB() {
  try {
    await client.connect(); // ✅ CHANGED: removed duplicate URL param, using constructor’s URL
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
}

connectDB(); 
//collections
const databaseOFQuick = client.db(dbOfQuickLook);
const collectionJobSeekerDetails = databaseOFQuick.collection('JobSeekerDetails');
const collectionOFPostedJobs = databaseOFQuick.collection('PostedJobs');

const collectionJobSeekerApplication = databaseOFQuick.collection('Applications');

const collectionNotifications = databaseOFQuick.collection('notifications')

//--------------------- Haversine Distance ---------------------//
//  ADDED: helper function to calculate distance in km
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const toRad = (val) => (val * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

//  ADDED: geocoding function
async function geocodeAddress(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
  const res = await axios.get(url, {
    headers: { "User-Agent": "JobAppBackend" } // required by OSM
  });
  if (res.data.length > 0) {
    return {
      lat: parseFloat(res.data[0].lat),
      lon: parseFloat(res.data[0].lon)
    };
  }
  return null;
}



//--------------------- JobSeeker Profile ---------------------//
const JobSeekerprofile = async(req,res) =>{
  try {
    const CheckJobSeekerId = req.JobSeekerId; // req.JobSeekerId got it from AuthMiddleware
    console.log('JobSeekerprofile id in JobSeekerId Profile',CheckJobSeekerId)
    if (!CheckJobSeekerId) {
      console.log('this id is error')
      return res.status(400).json({ message: 'Missing JobSeekerId' });
    }

    const result = await collectionJobSeekerDetails.findOne({ JobSeekerId: CheckJobSeekerId });

    if (!result) {
      console.log('no match found')
      return res.status(404).json({ message: 'No details found' });
    }
    console.log(result)
    res.status(200).json({ result });
  }
  catch (err) {
    console.error('Error in JobSeekerId:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

//--------------------- Get Nearby Jobs ---------------------//
const getNearByPostedJobs = async (req, res) => {
  try {
    const { address, area, city, state, jobSeekerId } = req.body; 

    if (!city || !state) 
      return res.status(400).json({ message: "City and state are required" });

    let query;
    if (area && area.trim() !== "") {
      query = {
        $and: [
          { "location.state": { $regex: state, $options: "i" } },
          {
            $or: [
              { "location.area": { $regex: area, $options: "i" } },
              { "location.city": { $regex: city, $options: "i" } }
            ]
          }
        ]
      };
    } else {
      query = {
        "location.city": { $regex: city, $options: "i" },
        "location.state": { $regex: state, $options: "i" }
      };
    }

    let jobsArray = await collectionOFPostedJobs
      .find(query, { projection: { employerId: 0, _id: 0 } })
      .toArray();

    if (!jobsArray || jobsArray.length === 0) {
      console.log("not found");
      return res.status(404).json({ message: "No jobs found near you" });
    }

    //  Get all applications of this job seeker
    const applications = await collectionJobSeekerApplication
      .find({ jobSeekerId })
      .project({ jobPostId: 1, _id: 0 })
      .toArray();

    const appliedJobIds = applications.map(app => app.jobPostId);

    // ✅ FIX: Use hardcoded fallback coordinates if geocode fails or fictional area is provided
    let userLocation = await geocodeAddress(`${area || ""} ${city}, ${state}`);
    if (!userLocation || !userLocation.lat || !userLocation.lon) {
      console.log("Using fallback coordinates for Kochi (Edappally area)");
      userLocation = { lat: 10.025487, lon: 76.3079848 }; // Edappally, Kochi
    }

    // ADDED: Calculate distance and applied flag for each job (distance logic unchanged)
    jobsArray = jobsArray
      .map(job => {
        const applied = appliedJobIds.includes(job.jobPostId);

        if (job.locationCoordinates && job.locationCoordinates.coordinates) {
          const [jobLon, jobLat] = job.locationCoordinates.coordinates; 
          const distance = calculateDistance(userLocation.lat, userLocation.lon, jobLat, jobLon);
          console.log(`Job: ${job.jobTitle}, Distance: ${distance.toFixed(2)} km`); // distance log
          return { ...job, distance: parseFloat(distance.toFixed(2)), applied };
        }

        return { ...job, distance: null, applied };
      })
      .filter(job => job.distance !== null && job.distance <= 10); // distance filter unchanged

    res.status(200).json(jobsArray);
  } catch (err) {
    console.error("Error fetching nearby posted jobs:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};






const appliedJobseekerApplication = async (req, res) => {
  try {
    const applicationData = req.body;
    console.log('applicationData', applicationData);

    //  Get employer info and job title  collectionJobSeekerDetails

 const applicantName =  await collectionJobSeekerDetails.findOne({JobSeekerId:Number(applicationData.jobSeekerId)},
   {projection:{_id:0,fullName:1}}
 )
console.log('applicant Name',applicantName)
    const InfoForNotification = await collectionOFPostedJobs.findOne(
      { jobPostId: applicationData.jobPostId },
      { projection: { _id: 0, employerId: 1, jobTitle: 1 } }
    );

    if (!InfoForNotification) {
      return res.status(404).json({ message: 'Job post not found' });
    }

    //  Add created timestamp
    applicationData.createdAt = new Date();

    //  Save application
    const result = await collectionJobSeekerApplication.insertOne(applicationData);

    //  Prepare notification message
    const notificationMessage = `${ applicantName.fullName || 'A jobseeker'} applied for ${InfoForNotification.jobTitle}.`;

    //  Insert notification for employer
    await collectionNotifications.insertOne({
      employerId: InfoForNotification.employerId, // employer receiving notification
      jobPostId: applicationData.jobPostId,
      message: notificationMessage,
      status: 'pending',
      read: false,
      createdAt: new Date()
    });

    res.status(201).json({
      message: 'Application submitted successfully'
    });

  } catch (err) {
    console.error('Error saving application:', err);
    res.status(500).json({ error: 'Failed to save application' });
  }
};


const getJobSeekerSchedules = async (req, res) => {
  try {
    const JobSeekerId = String(req.JobSeekerId);

    const SchedulesData = await collectionJobSeekerApplication.aggregate([
      { $match: { jobSeekerId: JobSeekerId, status: "accepted" } },

      // Lookup job info
      {
        $lookup: {
          from: "PostedJobs",
          localField: "jobPostId",
          foreignField: "jobPostId",
          as: "jobInfo"
        }
      },
      { $unwind: { path: "$jobInfo", preserveNullAndEmptyArrays: true } },

      // Lookup employer info by converting employId to string
      {
        $lookup: {
          from: "employerDetails",
          let: { employerIdStr: { $toString: "$jobInfo.employerId" } },
          pipeline: [
            { $addFields: { employIdStr: { $toString: "$employId" } } },
            { $match: { $expr: { $eq: ["$employIdStr", "$$employerIdStr"] } } }
          ],
          as: "employerInfo"
        }
      },
      { $unwind: { path: "$employerInfo", preserveNullAndEmptyArrays: true } },

      // Add employer info to top level
      {
        $addFields: {
          jobId: "$jobPostId",
          jobTitle: "$jobInfo.jobTitle",
          jobImage: "$jobInfo.image",
          businessName: "$jobInfo.businessName",
          employerName: "$employerInfo.personName",
          employerPhoneNumber: "$employerInfo.contactNumber",
          employerImgUrl: "$employerInfo.profileImg"
        }
      },

      // Project only what frontend needs
      {
        $project: {
          _id: 0,
          schedules: 1,
          jobId: 1,
          jobTitle: 1,
          jobImage: 1,
          businessName: 1,
          employerName: 1,
          employerPhoneNumber: 1,
          employerImgUrl: 1
        }
      }
    ]).toArray();

    // Print aggregation result to check employer info
    console.log("Aggregation Result with Employer Info:", JSON.stringify(SchedulesData, null, 2));

    res.status(200).json({ message: "Success", data: SchedulesData });
  } catch (err) {
    console.error("❌ Error fetching schedules:", err);
    res.status(500).json({ message: "Failed to fetch schedules" });
  }
};

const changeScheduleStatus = async (req, res) => {
  try {
    const jobSeekerId = String(req.JobSeekerId); // set in middleware

    const { scheduledDate, jobPostId, statusofSchedules, startTime, endTime } = req.body;

    // Fetch applicant name
    const applicantData = await collectionJobSeekerDetails.findOne(
      { JobSeekerId: Number(jobSeekerId) },
      { projection: { _id: 0, fullName: 1 } }
    );
  const applicantName = (applicantData?.fullName || "A jobseeker")
  .toLowerCase()
  .split(' ')
  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');


    console.log("JobSeekerId", jobSeekerId);
    console.log("jobPostId", jobPostId);
    console.log("scheduledDate", scheduledDate);
    console.log("statusofSchedules", statusofSchedules);
    console.log("startTime", startTime);
    console.log("endTime", endTime);

    // Fetch employer info
    const dataInfoNotification = await collectionOFPostedJobs.findOne(
      { jobPostId },
      { projection: { _id: 0, employerId: 1, jobTitle: 1 } }
    );

    // Update schedule status
    const result = await collectionJobSeekerApplication.updateOne(
      {
        jobSeekerId: jobSeekerId,
        jobPostId: jobPostId
      },
      {
        $set: {
          "schedules.$[sched].Schedulestatus": statusofSchedules
        }
      },
      {
        arrayFilters: [{ "sched.date": scheduledDate }]
      }
    );

    //  Insert notification if update successful
    if (result.modifiedCount > 0) {
      const jobTitle = dataInfoNotification?.jobTitle || "Job";

      const actionText = statusofSchedules.toLowerCase() === "accepted" ? "accepted" : "rejected";

      const notificationMessage = `${applicantName} has ${actionText} schedule of ${jobTitle} on ${scheduledDate} (${startTime}-${endTime})`;

      await collectionNotifications.insertOne({
        employerId: dataInfoNotification?.employerId,
        jobPostId,
        message: notificationMessage,
        status: statusofSchedules.toLowerCase(),
        read: false,
        createdAt: new Date()
      });

      res.status(200).json({ success: true, message: "Schedule status updated" });
    } else {
      res.status(404).json({ success: false, message: "No matching schedule found" });
    }

  } catch (err) {
    console.error("❌ Error updating schedule status:", err);
    res.status(500).json({ message: "Failed to change ScheduleStatus" });
  }
};

const getApplicationStatus = async (req, res) => {
  try {
    const jobSeekerId = String(req.JobSeekerId);
    console.log('this is getApplicationStatus jobSeekerId', jobSeekerId);

    const ApplicationStatusData = await collectionJobSeekerApplication.aggregate([
      { $match: { jobSeekerId: jobSeekerId } },

      // Lookup job info
      {
        $lookup: {
          from: "PostedJobs",
          localField: "jobPostId",
          foreignField: "jobPostId",
          as: "jobInfo"
        }
      },
      { $unwind: { path: "$jobInfo", preserveNullAndEmptyArrays: true } },

      // Lookup employer info
      {
        $lookup: {
          from: "employerDetails",
          let: { employerIdStr: { $toString: "$jobInfo.employerId" } },
          pipeline: [
            { $addFields: { employIdStr: { $toString: "$employId" } } },
            { $match: { $expr: { $eq: ["$employIdStr", "$$employerIdStr"] } } }
          ],
          as: "employerInfo"
        }
      },
      { $unwind: { path: "$employerInfo", preserveNullAndEmptyArrays: true } },

      // Prepare final data
      {
        $project: {
          _id: 0,
          jobId: "$jobPostId",
          jobTitle: "$jobInfo.jobTitle",
          jobImage: "$jobInfo.image",
          businessName: "$jobInfo.businessName",
          employerName: "$employerInfo.personName",
          employerPhoneNumber: "$employerInfo.contactNumber",
          employerImgUrl: "$employerInfo.profileImg",
          AppliedDate: "$appliedDate",
          StatusApplied: "$status" // from Application collection
        }
      }
    ]).toArray();

    console.log('ApplicationStatusData', ApplicationStatusData);
    res.status(200).json({ message: "Success", data: ApplicationStatusData });

  } catch (err) {
    console.error("❌ Error getting application status:", err);
    res.status(500).json({ message: "Failed to fetch application status" });
  }
};

const getJobSeekerDetails = async (req, res) =>{

     const jobSeekerId = req.JobSeekerId;
    console.log('this is getApplicationStatus jobSeekerId', jobSeekerId);
  try{
const result = await collectionJobSeekerDetails.findOne({ JobSeekerId: jobSeekerId });
console.log('result of job seeker details',result)
if(result){
 res.status(200).json({ success: true, message: {result} });
}
else{
   res.status(404).json({ success: false, message: "No matching schedule found" });
}

  }
  catch (err) {
    console.error("❌ Error getting application status:", err);
    res.status(500).json({ message: "Failed to fetch application status" });
  }
}



const updateJobSeekerProfile = async (req, res) => {
  try {
    // Convert JobSeekerId from frontend (string) to number
    const jobSeekerId = Number(req.JobSeekerId || req.body.JobSeekerId);
    if (!jobSeekerId) {
      return res.status(400).json({ message: 'JobSeekerId is required' });
    }

    // Map frontend keys to backend keys
    const fieldMap = {
      Name: 'fullName',
      emailId: 'email',
      contactNumber: 'contactNumber',
      dateOfBirth: 'dateOfBirth',
      Address: 'address',
      area: 'area',
      city: 'city',
      state: 'state',
      PreferJob: 'preferredJobTypes',
      Skills: 'skills',
      MaxHourPerDay: 'MaxHourPerDay'
    };

    // Build update object
    const updateFields = {};
    for (const frontendKey in fieldMap) {
      const backendKey = fieldMap[frontendKey];
      if (req.body[frontendKey] !== undefined && req.body[frontendKey] !== '') {
        updateFields[backendKey] = req.body[frontendKey];
      }
  // 1 st iteration
//       frontendKey = "Name"
// backendKey = fieldMap["Name"] = "fullName"
// req.body[frontendKey] = req.body["Name"] = "Rohan Kumar"
// updateFields[backendKey] = updateFields["fullName"] = "Rohan Kumar"
    }

    // Include image if uploaded
    if (req.file && req.file.path) {
      updateFields.ImageProfile = req.file.path;

//       req.file comes from Multer/Cloudinary.

// req.file.path is the URL of the uploaded image in Cloudinary.

// If an image is uploaded, it will be added to updateFields.
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    // Update in MongoDB
    await collectionJobSeekerDetails.updateOne(
      { JobSeekerId: jobSeekerId },
      { $set: updateFields }
    );

    res.status(200).json({ message: 'Job Seeker profile updated successfully' });
  } catch (err) {
    console.error('❌ Error updating Job Seeker profile:', err);
    res.status(500).json({ message: 'Failed to update profile' });


    //
  }
};


const ResetPassword = async (req, res) => {
  try {
    const { email } = req.body;
    console.log(' Backend received email:', email);

    // Step 1: Check if user exists
    const existingUser = await collectionJobSeekerDetails.findOne({ email: email });

    if (!existingUser) {
      console.log(' Email not registered:', email);
      return res.status(404).json({ message: 'Email not registered' });
    }

    // Step 2: Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000);
    console.log(' OTP generated for', email, ':', otp);

    // Step 3: Send OTP via Gmail using Nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'talktoananthu@gmail.com',       // Replace with your Gmail
        pass: 'evwm ygms zodb gnnp',         // Use Gmail App Password  
      },
    });

    const mailOptions = {
      from: '"QuickLook Support" <sample@gmail.com>',
      to: email,
      subject: 'QuickLook Password Reset OTP',
      html: `
        <div style="font-family: Poppins, sans-serif;">
          <h2 style="color:#007bff;">QuickLook Password Reset</h2>
          <p>Hello ${existingUser.fullName},</p>
          <p>Your OTP for resetting your password is:</p>
          <h1 style="letter-spacing: 3px;">${otp}</h1>
          <p>This OTP is valid for <b>4 minutes</b>.</p>
          <p>If you didn’t request this, please ignore this email.</p>
          <br />
          <p>– Team FindQuick</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(' OTP sent successfully to', email);

    // Step 4: Store OTP in DB for 4 minutes
    await collectionJobSeekerDetails.updateOne(
      { email: email },
      { $set: { otp: otp, otpCreatedAt: new Date() } }
    );

    // Step 5: Respond to frontend
    res.status(200).json({
      message: 'OTP sent successfully',
      email,
    });

  } catch (err) {
    console.error('❌ Error in ResetPassword:', err);
    res.status(500).json({ message: 'Failed to process request' });
  }
};

const checkingOtpForJobSeeker = async(req,res)=>{
  try{
     const {email,otpNumber} = req.body
     console.log('email',email)
      console.log('otpNumber',otpNumber)
     const existingUser = await collectionJobSeekerDetails.findOne({ email: email},{
      projection:{_id:0,otp:1}
     });
     if(existingUser.otp==otpNumber){
      console.log('Correct otp')
    res.status(200).json({
      message: 'Correct otp'
    });

     }
     else{
      console.log('otp does not match')
      res.status(400).json({
      message: ' otp does not Match'
    });
     }
     
  }
  catch (err){
      console.error('❌ Error in Checking otp:', err);
    res.status(500).json({ message: 'Failed to Check Otp' });
  }
}

const settingNewPassword = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('email', email);
    console.log('password', password);

    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const update = await collectionJobSeekerDetails.updateOne(
      { email: email },
      { $set: { password: hashedPassword } }
    );

    // Check if password was actually modified
    if (update.modifiedCount > 0) {
      return res.status(200).json({ message: 'Password updated successfully' });
    } else {
      return res.status(404).json({ message: 'No user found or password unchanged' });
    }
  } catch (err) {
    console.error('❌ Error setting new password:', err);
    res.status(500).json({ message: 'Failed to set new password' });
  }
};

const getNotification = async (req, res) => {
  try {
    // Convert to string immediately
    const jobSeekerId = String(req.JobSeekerId); 
    console.log('JobSeekerId (as string):', jobSeekerId);

    if (!jobSeekerId) {
      console.log('JobSeekerId missing');
      return res.status(400).json({ message: 'Missing JobSeekerId' });
    }

    // Fetch notifications for this jobseeker, latest first
    const notifications = await collectionNotifications
      .find({ jobSeekerId: jobSeekerId })
      .sort({ createdAt: -1 })
      .toArray();

    console.log('Fetched notifications:', notifications);

    // Count unread notifications
    const unreadCount = await collectionNotifications.countDocuments({
      jobSeekerId: jobSeekerId,
      read: false
    });

    return res.json({
      notifications,
      unreadCount
    });

  } catch (err) {
    console.error(' Error fetching notifications:', err);
    return res.status(500).json({ message: 'Failed to get notifications' });
  }
};

const makeNotificationTrue= async(req,res)=>{

  try{
 const jobSeekerId = String(req.JobSeekerId); 
    console.log('JobSeekerId (as string):',typeof jobSeekerId);
      if (!jobSeekerId) {
      console.log('JobSeekerId missing');
      return res.status(400).json({ message: 'Missing JobSeekerId' });
    }

    const updateNotification = await collectionNotifications.updateMany({
jobSeekerId:jobSeekerId},
  {$set:{read:true}}
)

  if (updateNotification.modifiedCount > 0) {
      return res.status(200).json({ message: 'notification updated ' });
    } else {
      return res.status(404).json({ message: 'notification not updated' });
    }


  }
  catch(err){
    console.error(' Error fetching notifications:', err);
    return res.status(500).json({ message: 'Failed to connect with notification' });
  }
}

const deleteNotification = async (req, res) => {
  try {
    const jobSeekerId = String(req.JobSeekerId); // from middleware
    const { userId, NotId } = req.body;

    if (!jobSeekerId) {
      return res.status(400).json({ message: "Missing JobSeekerId" });
    }

    if (!NotId) {
      return res.status(400).json({ message: "Missing Notification Date" });
    }

    // Convert date string to actual Date object for MongoDB match
    const notificationDate = new Date(NotId);

    // Delete the specific notification
    const deleteResult = await collectionNotifications.deleteOne({
      jobSeekerId: userId,
      createdAt: notificationDate
    });

    if (deleteResult.deletedCount > 0) {
      return res.status(200).json({ message: "Notification deleted successfully" });
    } else {
      return res.status(404).json({ message: "Notification not found" });
    }

  } catch (err) {
    console.error("Error deleting notification:", err);
    return res.status(500).json({ message: "Server error deleting notification" });
  }
};




module.exports = { 
  JobSeekerprofile,
  getNearByPostedJobs,
  appliedJobseekerApplication,
  getJobSeekerSchedules,
  changeScheduleStatus,
  getApplicationStatus,
  getJobSeekerDetails,
  updateJobSeekerProfile,
  ResetPassword,
  checkingOtpForJobSeeker,
  settingNewPassword,
  getNotification,
  makeNotificationTrue,
  deleteNotification
}; 
