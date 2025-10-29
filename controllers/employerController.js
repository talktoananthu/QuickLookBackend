const { MongoClient } = require('mongodb');
const nodemailer = require('nodemailer');
require('dotenv').config(); 
const client = new MongoClient(process.env.MONGO_URI);
const { BSON } = require("bson");
const bcrypt = require('bcrypt')
//variable for storing database Name
const dbOfQuickLook = 'QuickLook'


//  added: simple ID generator
function generateSimpleJobPostId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase(); // e.g., "A1B2C3"
}

//connection with MongoDB----------

const axios = require('axios');
const { constants } = require('buffer');

// Convert text address to lat/lng using OpenStreetMap
async function geocodeAddress(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
  const res = await axios.get(url, {
    headers: { 'User-Agent': 'JobAppBackend' } // required by OSM
  });

  if (res.data.length > 0) {
    return {
      lat: parseFloat(res.data[0].lat),
      lng: parseFloat(res.data[0].lon)
    };
  }
  return null;
}

async function connectDB() {
  try {
    await client.connect(); // connect without passing URL again, already passed in constructor
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
}

connectDB(); // call the async function once when this module loads

//datavase ---------------------------------------------
const databaseOFQuick = client.db(dbOfQuickLook);

//collections ---------------------------------------------
const collectionPostedJobs = databaseOFQuick.collection('PostedJobs');
const collectionEmployerProfile = databaseOFQuick.collection('employerDetails');

const collectionApplications = databaseOFQuick.collection('Applications')

const collectionJobSeekerDetails = databaseOFQuick.collection('JobSeekerDetails')

const collectionNotifications = databaseOFQuick.collection('notifications')

//collections End--------------------------------------------- 



//posting job details is here--------------------
const postJobDetails = async (req, res) => {
  try {
    //  added: generate unique jobPostId
    let jobPostId;
    let isUnique = false;

    while (!isUnique) {
      jobPostId = generateSimpleJobPostId();
      const existing = await collectionPostedJobs.findOne({ jobPostId });
      if (!existing) isUnique = true;
    }

    // Get image URL from Cloudinary
    const imageUrl = req.file?.path || ''; // fallback to empty string if not provided

    // -------------------- ADDED: Generate coordinates from location --------------------
    let locationCoordinates = null;
    if (req.body.location) {
      let locationData = req.body.location;

      // ✅ FIX: Parse if it's a stringified JSON
      if (typeof locationData === 'string') {
        try {
          locationData = JSON.parse(locationData);
        } catch (err) {
          console.error("Failed to parse location JSON:", err);
        }
      }

      let addressString = '';
      if (typeof locationData === 'object') {
        const { area = '', city = '', state = '' } = locationData;
        //  Added ", India" here
        addressString = `${area.trim()}, ${city.trim()}, ${state.trim()}, India`;
      } else {
        //  Added ", India" here
        addressString = `${locationData.trim()}, India`;
      }

      if (addressString) {
        console.log("Geocoding address:", addressString); // debug log
        const geoRes = await geocodeAddress(addressString); // your geocode function
        console.log("Geocode result:", geoRes); // debug log
        if (geoRes) {
          locationCoordinates = {
            type: 'Point',
            coordinates: [geoRes.lng, geoRes.lat] // [longitude, latitude]
          };
        }
      }
    }
    // -------------------- END ADDED --------------------

    const postedJobData = {
      jobPostId, //  added field
      ...req.body,
      image: imageUrl,
      locationCoordinates // store coordinates along with the original location
    };

    await collectionPostedJobs.insertOne(postedJobData);
    res.status(201).json({ message: 'Job posted successfully', jobPostId });
  } catch (err) {
    console.error('Error inserting job:', err);
    res.status(500).json({ message: 'Failed to post job' });
  }
};




//const for getting the postedJobs available
const getPostedJobs = async (req, res) => {
  try {
    const empId = req.empId; // this comes from decoded JWT in auth middleware
    console.log('backend in getPostedJobs:', empId);

    // Use the shared collection object (already connected in your file)
    const jobs = await collectionPostedJobs.find({ employerId : String(empId)}).toArray();

    if (!jobs.length) {
      console.log('no data')
     return res.status(200).json([]);
    }
     else{
      console.log('sucess in getting jobs')
  res.status(200).json(jobs);
     }
   //  Return job data, not a jobPostId here
  } catch (err) {
    console.error('Error fetching jobs:', err);
    res.status(500).json({ message: 'Failed to fetch posted jobs' });
  }
};

const updatePostedJob = async (req, res) => {
  try {
    const updatedJobData = req.body;

    const CheckjobId = updatedJobData.jobPostId;
    const CheckemployerId = updatedJobData.employerId;

    if (!CheckjobId || !CheckemployerId) {
      return res.status(400).json({ message: 'Missing jobPostId or employerId' });
    }

    // Remove identifiers from the update payload to prevent accidental overwrite
    delete updatedJobData.jobPostId;
    delete updatedJobData.employerId;
    delete updatedJobData._id; // Always remove _id before updating

    const result = await collectionPostedJobs.updateOne(
      {
        jobPostId: CheckjobId,
        employerId: CheckemployerId
      },
      {
        $set: updatedJobData
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'No matching job found to update' });
    }

    res.status(200).json({ message: 'Job updated successfully', result });
  } catch (err) {
    console.error('Error in updatePostedJob:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const EmployerProfile = async (req, res) => {
  try {
    const CheckemployerId = req.empId;
   console.log('employer id in employer Profile',CheckemployerId)
    if ( !CheckemployerId) {
      console.log('this id is error')
      return res.status(400).json({ message: 'Missing  employerId' });
    }

  
   

    const result = await collectionEmployerProfile.findOne({ employId: CheckemployerId });

    if (!result) {
      console.log('no match found')
      return res.status(404).json({ message: 'No details found' });
    }

    res.status(200).json({  result });
  } catch (err) {
    console.error('Error in updatePostedJob:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const updateEmployerProfile = async (req, res) => {


  try {
    const CheckemployerId = req.empId;

    // List of fields allowed to update — password excluded
    const allowedFields = [
      'personName',
      'jobPosition',
      'email',
      'jobPlace',
      'companyAddress',
      'contactNumber',
      'employId',
    ];

    // Build updateFields only from allowed fields present in req.body
    const updateFields = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined && req.body[field] !== '') {
        updateFields[field] = req.body[field];
      }
    }

    // Add profileImg if image uploaded
    if (req.file && req.file.path) {
      updateFields.profileImg = req.file.path;
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    await collectionEmployerProfile.updateOne(
      { employId:CheckemployerId  },
      { $set: updateFields }
    );

    res.status(200).json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error('Error updating employer profile:', err);
    res.status(500).json({ message: 'Failed to update profile' });
  }
};


//below logic is perfromed not based on aggregation
const getApplicantDetails = async (req, res) => {
  console.log(' getApplicantDetails function started');

  try {
    // Convert employerId from middleware to string
    const employerIdasNumber = req.empId;
    const employerId = String(employerIdasNumber).trim();
    console.log(' typeof employerId:', typeof employerId);
    console.log(' employerId (as string):', employerId);

    //  Get all jobPostIds for this employer
   const postedJobs = await collectionPostedJobs
  .find({ employerId: employerId })
  .project({
    jobPostId: 1,
    jobTitle: 1,
    startTime: 1,      //  include startTime
    endTime: 1,        //  include endTime
    jobType: 1,        //  include jobType
    _id: 0
  })
  .toArray();

    console.log(' Posted jobs for employer:', postedJobs);

    if (!postedJobs.length) {
      console.log(' No posted jobs found for this employer');
      return res.json([]);
    }

    const jobPostIds = postedJobs.map(job => job.jobPostId);
    console.log(' JobPostIds to check in Applications:', jobPostIds);

    //  Get all applications for these jobPostIds
    const applications = await collectionApplications
      .find({ jobPostId: { $in: jobPostIds } })
      .toArray();

    console.log(' Applications found:', applications);

    if (!applications.length) {
      console.log('❌ No applications found for these job posts');
      return res.json([]);
    }

    //  Get all JobSeekerDetails for these applicants
    // Convert string jobSeekerIds from applications to numbers to match DB
    const jobSeekerIds = applications.map(app => Number(app.jobSeekerId));
    console.log(' JobSeekerIds to fetch details (as numbers):', jobSeekerIds);

    const jobSeekers = await collectionJobSeekerDetails
      .find({ JobSeekerId: { $in: jobSeekerIds } })
      .toArray();

    console.log(' JobSeeker details fetched:', jobSeekers);

    if (!jobSeekers.length) {
      console.log(' No job seeker details found for these IDs');
      return res.json([]);
    }

    //  Combine applications with job and job seeker info
    const result = applications.map(app => {
      const seeker = jobSeekers.find(js => js.JobSeekerId === Number(app.jobSeekerId));
      const job = postedJobs.find(j => j.jobPostId === app.jobPostId);

      if (!seeker || !job) {
        console.log(' Missing seeker or job for application:', app);
        return null;
      }

      return {
        applicantId: seeker.JobSeekerId.toString(), // convert back to string if frontend expects string
        jobId: app.jobPostId,
        jobTitle: job.jobTitle,
        applicantName: seeker.fullName,
        applicantEmail: seeker.email,
        appliedDate: app.appliedDate,
        payment: app.amount,
        imgProfile: seeker.ImageProfile || '',
        contactNumber: seeker.contactNumber,
        applicationStatus: app.status,
        applicantDOB: seeker.dateOfBirth,
        applicantAddressLoc: {
          applicantAddress: seeker.address,
          applicantArea: seeker.area,
          applicantCity: seeker.city,
          applicantState: seeker.state
        },
        applicantsPreferJObTypes: seeker.preferredJobTypes || null,
        applicantSkills: seeker.skills || null,
         applicantsShiftStartTime: job.startTime || '',
    applicantsShiftEndTime: job.endTime || '',
     applicantJobType: job.jobType || '',
      schedules: app.schedules || []
      };
    }).filter(Boolean); // remove nulls if any

    console.log(' Final result to send:', result);

    return res.json(result);

  } catch (error) {
    console.error(' Error fetching applicant details:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

const HiredOrRejectApplicants = async (req, res) => {
  console.log('this is hire function');
  console.log('request body:', req.body);

  const StatusDetails = req.body;
  const JobPostid = StatusDetails.applicantJobPostId;
  const applicantId = StatusDetails.applicantsDetialsId;
  const statusToApply = StatusDetails.statusVal;

  // Get job title
  const JobApplicationName = await collectionPostedJobs.findOne(
    { jobPostId: JobPostid },
    { projection: { jobTitle: 1, _id: 0 } }
  );

  if (statusToApply === 'accepted') {
    try {
      // Get current hired count
      const result = await collectionPostedJobs.findOne(
        { jobPostId: JobPostid },
        { projection: { hired: 1, _id: 0 } }
      );

      // Convert to number and increment
      let hiredCount = result ? Number(result.hired) : 0;
      hiredCount += 1;
      console.log('Updated hired count:', hiredCount);

      // Update in DB
      await collectionPostedJobs.updateOne(
        { jobPostId: JobPostid },
        { $set: { hired: String(hiredCount) } }
      );

      console.log('Hired count updated successfully');
    } catch (err) {
      console.error('Error updating hired count:', err);
    }
  }

  console.log('job post ID:', JobPostid);
  console.log('applicant ID:', applicantId);
  console.log('status to apply:', statusToApply);

  try {
    const updateResult = await collectionApplications.updateOne(
      {
        jobPostId: JobPostid,
        jobSeekerId: applicantId
      },
      {
        $set: { status: statusToApply }
      }
    );

    if (updateResult.matchedCount === 0) {
      console.log('❌ No matching application found');
      return res.status(404).json({ message: 'Application not found' });
    }

    console.log(' Status updated successfully');

    // ---------------- Notification Code ----------------
    const notificationMessage = `${JobApplicationName.jobTitle} role: ${statusToApply.charAt(0).toUpperCase() + statusToApply.slice(1)}.`;

   await collectionNotifications.insertOne({
  jobSeekerId: applicantId,
  jobPostId: JobPostid,
  message: notificationMessage,
  status: statusToApply,
  read: false,      // <-- unread initially
  notificationType:'AppliedJobs',
  createdAt: new Date()
});

    console.log('Notification sent to jobseeker');
    // ---------------------------------------------------

    return res.json({ message: 'Application status updated successfully' });
  } catch (error) {
    console.error('❌ Error in hiring:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};


const AssignSchedulesToApplicants = async (req, res) => {
  try {
    const { applicantDetailId, JobPostDetailsId, schedules } = req.body;

    if (!applicantDetailId || !JobPostDetailsId || !Array.isArray(schedules) || schedules.length === 0) {
      return res.status(400).json({ message: 'Invalid input' });
    }

    const jobId = String(JobPostDetailsId);
    const applicantId = String(applicantDetailId);

    // ✅ Get job title
    const jobInfo = await collectionPostedJobs.findOne(
      { jobPostId: jobId },
      { projection: { _id: 0, jobTitle: 1 } }
    );

    if (!jobInfo) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // ✅ Format schedules
    const plainSchedules = schedules.map((s) => ({
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      Schedulestatus: s.Schedulestatus,
      hoursWorked: s.hoursWorked || null,
      paymentForDay: s.paymentForDay || null,
      remarks: s.remarks || null,
      paymentStatus: s.paymentStatus || 'pending',
      EmployerName: s.EmployerName,
      EmployerPhoneNumber: s.EmployerPhoneNumber,
      EmployerImgUrl: s.EmployerImgUrl,
    }));

    // ✅ Add schedules to the application
    const result = await collectionApplications.updateMany(
      { jobPostId: jobId, jobSeekerId: applicantId, status: 'accepted' },
      { $push: { schedules: { $each: plainSchedules } } },
      { upsert: false }
    );

    if (!result || result.matchedCount === 0) {
      return res.status(404).json({ message: 'No matching applicant with status=accepted' });
    }

    // ✅ Create notification message dynamically
    const notifications = plainSchedules.map((s) => ({
      jobSeekerId: applicantId,
      jobPostId: jobId,
      message: `${jobInfo.jobTitle} role: Schedule on ${s.date} (${s.startTime}-${s.endTime}) assigned.`,
      status: 'accepted',
      read: false,
       notificationType:'Inbox',
      createdAt: new Date(),
    }));

    // ✅ Insert notifications
    await collectionNotifications.insertMany(notifications);

    return res.status(200).json({
      message: 'Schedules added and notifications created successfully',
    });
  } catch (err) {
    console.error('❌ Error in AssignSchedulesToApplicants:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};


const AssignAttendanceToApplicants = async (req, res) => {
  console.log('this is AssignAttendanceToApplicants');
  try {
    const { applicantId, jobPostId, scheduleDate, attendance } = req.body;

    console.log('applicant ID:', applicantId, 'type:', typeof applicantId);
    console.log('jobPost ID:', jobPostId, 'type:', typeof jobPostId);
    console.log('scheduleDate :', scheduleDate, 'type:', typeof scheduleDate);
    console.log('status to apply:', attendance, 'type:', typeof attendance);

    const doc = await collectionApplications.findOne({
      jobSeekerId: applicantId,
      jobPostId: jobPostId
    });
    console.log('data founded', doc);

    if (!doc) return res.status(404).json({ message: "Applicant not found" });

    // Function to calculate hours worked
    const calculateHoursWorked = (startTimeStr, endTimeStr) => {
      const parseTime = (timeStr) => {
        const [time, modifier] = timeStr.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (modifier === 'PM' && hours !== 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
        return hours + minutes / 60;
      };

      let hoursWorked = parseTime(endTimeStr) - parseTime(startTimeStr);
      if (hoursWorked < 0) hoursWorked += 24; // handle overnight shifts

      // round to 2 decimal places
      return Math.round(hoursWorked * 100) / 100;
    };

    // Find the specific schedule object
    const scheduleObj = doc.schedules.find(s => s.date === scheduleDate);
    const hoursWorked = scheduleObj ? calculateHoursWorked(scheduleObj.startTime, scheduleObj.endTime) : null;

    // Update schedule status and hours worked
    const result = await collectionApplications.updateOne(
      {
        jobSeekerId: applicantId.trim(),
        jobPostId: jobPostId.trim(),
        "schedules.date": scheduleDate.trim()
      },
      {
        $set: {
          "schedules.$.Schedulestatus": attendance,
          "schedules.$.hoursWorked": hoursWorked
        }
      }
    );

    console.log("Matched:", result.matchedCount);
    console.log("Modified:", result.modifiedCount);

    //  Notification logic starts here
    const jobInfo = await collectionPostedJobs.findOne(
      { jobPostId: jobPostId },
      { projection: { _id: 0, jobTitle: 1 } }
    );

    const jobTitle = jobInfo?.jobTitle || "Job";

    let attendanceMessage = "";
    if (attendance.toLowerCase() === "completed") {
      attendanceMessage = `${jobTitle} marked Present on ${scheduleDate}.`;
    } else if (attendance.toLowerCase() === "absent") {
      attendanceMessage = `${jobTitle} marked Absent on ${scheduleDate}.`;
    } else {
      attendanceMessage = `${jobTitle} attendance updated on ${scheduleDate}.`;
    }

    await collectionNotifications.insertOne({
      jobSeekerId: applicantId,
      jobPostId: jobPostId,
      message: attendanceMessage,
      status: attendance.toLowerCase(),
      read: false,
       notificationType:'Inbox',
      createdAt: new Date()
    });
    //  Notification logic ends here

    return res.json({ success: true, result });

  } catch (error) {
    console.error('❌ Error in giving attendance:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

const AssignPaymentStatus = async (req, res) => {
  try {
    const { jobApplicant, jobPostId, date, payStatus } = req.body;

    console.log(' req.body', req.body);

    const result = await collectionApplications.updateOne(
      {
        jobPostId,
        jobSeekerId: jobApplicant
      },
      {
        $set: { "schedules.$[elem].paymentStatus": payStatus }
      },
      {
        arrayFilters: [{ "elem.date": date, "elem.Schedulestatus": "completed" }]
        // this actually checks each object element of array 
      }
    );

    if (result.modifiedCount > 0) {
      console.log('Payment status updated successfully');

      //  Fetch job title for notification message
      const jobInfo = await collectionPostedJobs.findOne(
        { jobPostId: jobPostId },
        { projection: { _id: 0, jobTitle: 1 } }
      );

      const jobTitle = jobInfo?.jobTitle || "Job";

      //  Create fixed notification message for paid
      const paymentMessage = `${jobTitle} job has been paid for ${date}.`;

      //  Insert notification into collectionNotifications
      await collectionNotifications.insertOne({
        jobSeekerId: jobApplicant,
        jobPostId: jobPostId,
        message: paymentMessage,
        status: "paid",
        read: false,
         notificationType:'Inbox',
        createdAt: new Date()
      });

      return res.status(200).json({ message: 'Payment status updated successfully' });
    } else {
      return res.status(404).json({ message: 'No matching schedule found' });
    }

  } catch (error) {
    console.error('❌ Error in updating payment status:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};


const ResetPasswordForEmployer = async (req, res) => {
  try {
    console.log('this is employer')
    const { email } = req.body;
    console.log(' Backend received email:', email);

    // Step 1: Check if user exists
    const existingUser = await collectionEmployerProfile.findOne({ email: email });

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
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  pool: true,          // keep connection alive
  maxConnections: 5,
  maxMessages: 100,
});

    const mailOptions = {
      from: '"QuickLook Support" <samplegmail@gmail.com>',
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
    await collectionEmployerProfile.updateOne(
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





const checkOtpForEmployer = async(req,res)=>{
   try{
     const {email,otpNumber} = req.body
     console.log('email',email)
      console.log('otpNumber',otpNumber)
     const existingUser = await collectionEmployerProfile.findOne({ email: email},{
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
  catch(err){

  } return res.status(500).json({ message: 'Internal Server Error' });
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

    const update = await collectionEmployerProfile.updateOne(
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
    const employerId = String(req.empId); 
    console.log('employerId (as string):', employerId);

    if (!employerId) {
      console.log('employerId missing');
      return res.status(400).json({ message: 'Missing employerId' });
    }

    // Fetch notifications for this jobseeker, latest first
    const notifications = await collectionNotifications
      .find({ employerId: employerId })
      .sort({ createdAt: -1 })
      .toArray();

    console.log('Fetched notifications:', notifications);

    // Count unread notifications
    const unreadCount = await collectionNotifications.countDocuments({
      employerId: employerId,
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
 const employerId = String(req.empId); 
    console.log('employerId (as string):',typeof employerId);
      if (!employerId) {
      console.log('employerId missing');
      return res.status(400).json({ message: 'Missing employerId' });
    }

    const updateNotification = await collectionNotifications.updateMany({

employerId:employerId},
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
    const employerId = String(req.empId); // from middleware
    const { userId, NotId } = req.body;

    if (!employerId) {
      return res.status(400).json({ message: "Missing JobSeekerId" });
    }

    if (!NotId) {
      return res.status(400).json({ message: "Missing Notification Date" });
    }

    // Convert date string to actual Date object for MongoDB match
    const notificationDate = new Date(NotId);

    // Delete the specific notification
    const deleteResult = await collectionNotifications.deleteOne({
      employerId: employerId,
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
  postJobDetails,
  getPostedJobs,
  updatePostedJob,
  EmployerProfile,
  updateEmployerProfile,
  getApplicantDetails,
  HiredOrRejectApplicants,
  AssignSchedulesToApplicants,
  AssignAttendanceToApplicants,
  AssignPaymentStatus,
  ResetPasswordForEmployer,
  checkOtpForEmployer,
  settingNewPassword,
  getNotification,
  makeNotificationTrue,
  deleteNotification
};


