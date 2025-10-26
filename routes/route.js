const express = require('express');
const router = express.Router();
const controller = require('../controllers/controller'); 
const employerController = require('../controllers/employerController')
const jobSeekerController = require('../controllers/jobSeekerController')
const { validateLogin } = require('../middleware/middleware');
const { authMiddlewareForEmployer,authMiddlewareForJobSeeker } = require('../middleware/authCheckerMiddleware');
const { upload } = require('../utils/cloudinary'); 
//to use controller funtionality declared in controller.js

// Example POST route: POST http://localhost:3000/api/hello
//registration url for employers

//----------------registration for Employer and JobSeeker----------
router.post('/addEmploy', controller.postEmployerDetails);

router.post('/addJobSeekerData',controller.postJobSeekerDetails)

//---------------- ENd----------



//got to middlware file to check validation of data after that goes to controller.login

//----------------Login  for Employer and JobSeeker----------
router.post('/login', validateLogin, controller.loginEmployer);

router.post('/loginJobSeeker',validateLogin,controller.loginJobSeeker)


//---------------- ENd----------


//authmiddleware for Jobseerker and Employer
router.get('/employerProfile', authMiddlewareForEmployer,(req, res) =>{
    console.log('auth worked for Employer')
  res.json({ message: 'You are authenticated!', user: req.user });
} );

router.get('/JobSeekerProfile',authMiddlewareForJobSeeker,(req, res) => { 
  console.log('auth worked for JObSeekerProfile')
  res.json({ message: 'You are authenticated!', user: req.user });
});

//---------------- ENd----------



//Posting the jobPosted by the employer
router.post('/employerPost',authMiddlewareForEmployer, upload.single('image'),employerController.postJobDetails)
//getting the jobPosted by the employer
router.get('/postedJobs',authMiddlewareForEmployer,employerController.getPostedJobs)
//getting the updating Posted Jobs by the employer
router.put('/updatePostedJob',authMiddlewareForEmployer,employerController.updatePostedJob)
//getting the employer Profile by the employer
router.get('/getEmpProfile',authMiddlewareForEmployer,employerController.EmployerProfile)

router.put('/updateEmpProfile',authMiddlewareForEmployer,upload.single('profileImage'),employerController.updateEmployerProfile)

router.get('/getApplicantsDetails',authMiddlewareForEmployer,employerController.getApplicantDetails)

router.put('/hiredOrRejectApplicant',authMiddlewareForEmployer,employerController.HiredOrRejectApplicants)


router.put('/assignedScehdulesToApplicant',authMiddlewareForEmployer,employerController.AssignSchedulesToApplicants)

router.put('/assignAttendanceToApplicant',authMiddlewareForEmployer,employerController.AssignAttendanceToApplicants)

router.put('/updatePaymentToApplicant',authMiddlewareForEmployer,employerController.AssignPaymentStatus)

router.post('/resetPasswordForEmployer',employerController.ResetPasswordForEmployer)

router.post('/checkOtpForEmployer',employerController.checkOtpForEmployer)

router.put('/SetNewPasswordForEmployer',employerController.settingNewPassword)

router.get('/getNotificationForEmployer',authMiddlewareForEmployer,employerController.getNotification)


router.get('/makeEmployerNotificationTrue',authMiddlewareForEmployer,employerController.makeNotificationTrue)


router.put('/deleteNotificationForEmployer',authMiddlewareForEmployer,employerController.deleteNotification)

//-------------------JObSeeker------------------------


router.get('/storeJobSeekerProfile',authMiddlewareForJobSeeker,jobSeekerController.JobSeekerprofile)

router.post('/JobSeekerAvailableJobs',authMiddlewareForJobSeeker,jobSeekerController.getNearByPostedJobs)

router.post('/JobSeekerApplication',authMiddlewareForJobSeeker,jobSeekerController.appliedJobseekerApplication)

router.get('/getSchedules',authMiddlewareForJobSeeker,jobSeekerController.getJobSeekerSchedules)

router.put('/statusSchedules',authMiddlewareForJobSeeker,jobSeekerController.changeScheduleStatus)

router.get('/gettingAppliedJobStatus',authMiddlewareForJobSeeker,jobSeekerController.getApplicationStatus)

router.get('/JobSeekerProfileDetails',authMiddlewareForJobSeeker,jobSeekerController.getJobSeekerDetails)

router.put('/updateJobSeekerProfile',authMiddlewareForJobSeeker,upload.single('ImageProfile'),jobSeekerController.updateJobSeekerProfile)

router.post('/resetPasswordForJobSeeker',jobSeekerController.ResetPassword)

router.post('/checkOtpForJobSeeker',jobSeekerController.checkingOtpForJobSeeker)

router.put('/SetNewPasswordForJobSeeker',jobSeekerController.settingNewPassword)


router.get('/getNotficationForJobSeeker',authMiddlewareForJobSeeker,jobSeekerController.getNotification)

router.get('/makeJobSeekerNotificationTrue',authMiddlewareForJobSeeker,jobSeekerController.makeNotificationTrue)

router.put('/deleteNotificationForJobSeeker',authMiddlewareForJobSeeker,jobSeekerController.deleteNotification)

module.exports = router;



//-------------------Case Study----------------

//for /profile i have to pass the token as an header to to pass the authMiddleware operation
//*************** */
// router.post('/login', validateLogin, controller.login);

 /*Above validateLogin is a middleware  */


//*************** */
//  router.get('/profile', authMiddleware, (req, res) => { 
//   res.json({ message: 'You are authenticated!', user: req.user });
// });

 /*Above authMiddleware is a middleware  */