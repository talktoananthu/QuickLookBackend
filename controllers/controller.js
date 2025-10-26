

const { MongoClient } = require('mongodb');

const bcrypt = require('bcrypt')

const jwt = require('jsonwebtoken');

const client = new MongoClient(process.env.MONGO_URI);

//variable for storing database Name
 const dbOfQuickLook =  'QuickLook'


//saving registration for Jobseeker Details
const postJobSeekerDetails = async (req, res) => {
  client.connect()
    .then(async connectionObj => { //async given here since so that 'await keyword can be used'
      const databaseOFQuick = connectionObj.db(dbOfQuickLook);
      const collectionJobSeekerDetails = databaseOFQuick.collection('JobSeekerDetails');
   console.log('this post JobseekerDetails')
      const JobSeeker = req.body;
      console.log('data',JobSeeker)
    
        if(JobSeeker.skills==null ){
          JobSeeker.skills == ''
        }
        if(JobSeeker.preferredJobTypes==null ){
          JobSeeker.preferredJobTypes == ''
        }
      //  Added: Check for duplicate email
      const existingJobSeeker = await collectionJobSeekerDetails.findOne({ email: JobSeeker.email });
      if (existingJobSeeker) {
        console.log('already exist this user')
        return res.status(409).json({ message: 'Email already registered' });
         //if return res.status is written to stop from further code running

      }
      //  End of added part

      //  Get the plain password from the request
      const plainPassword = JobSeeker.password;

      if (!plainPassword) {
        return res.status(400).json({ message: 'Password is required' });
      }

      try { //try is given if await operation catches and error while doing the operation
        //  Hash the password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

        //  Replace plain password with hashed one
        JobSeeker.password = hashedPassword;
        JobSeeker.JobSeekerId = Date.now();
          JobSeeker.ImageProfile = "",
         
        //  Inserting into MongoDB
        await collectionJobSeekerDetails.insertOne(JobSeeker);

        console.log('JobSeeker Details', JobSeeker);
        res.status(201).json({ message: 'JobSeeker registered successfully!' });

      } catch (error) {
        console.error('Error hashing password or inserting:', error);
        res.status(500).json({ message: 'Server error' });
      }

    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ message: 'Connection error' });
    });
};

//saving new registration for EmployerDetails
const postEmployerDetails = async (req, res) => {
  client.connect()
    .then(async connectionObj => { //async given here since so that 'await keyword can be used'
      const databaseOFQuick = connectionObj.db(dbOfQuickLook);
      const collectionEmployer = databaseOFQuick.collection('employerDetails');

      const employData = req.body;
      employData.employId = Date.now();

      // 🔄 Added: Check for duplicate email
      const existingEmployer = await collectionEmployer.findOne({ email: employData.email });
      if (existingEmployer) {
        return res.status(409).json({ message: 'Email already registered' });
         //if return res.status is written to stop from further code running

      }
      //  End of added part

      //  Get the plain password from the request
      const plainPassword = employData.password;

      if (!plainPassword) {
        return res.status(400).json({ message: 'Password is required' });
      }

      try { //try is given if await operation catches and error while doing the operation
        //  Hash the password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

        //  Replace plain password with hashed one
        employData.password = hashedPassword;

        //  Inserting into MongoDB
        await collectionEmployer.insertOne(employData);

        console.log('employer Details', employData);
        res.status(201).json({ message: 'Employer registered successfully!' });

      } catch (error) {
        console.error('Error hashing password or inserting:', error);
        res.status(500).json({ message: 'Server error' });
      }

    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ message: 'Connection error' });
    });
};




//login   in for generating JWT token--------------- login page for both Jobseeker and Employer

 const loginEmployer = async (req,res)=>{

   console.log('this is controller Data Received',req.body)

  const {emailId,passwordId} =  req.body;  //maked sure that date sent from frontend in the same key pair name
   console.log('email',emailId)
 console.log('password',passwordId)
 if(!emailId||!passwordId){
  console.log('destructing key is not coorector')
 }
  try{
    //creating connection with mongodb
     const connection = await client.connect()

      //dataBase Connection

      const db = connection.db('QuickLook');
      //collection connection

const employers = db.collection('employerDetails');

//checking and getting the object detail of user or if user is  present or not in the DB
 
 const employerDetails = await employers.findOne({ email :emailId });
   console.log(employerDetails)
 //if data is not present
    if (!employerDetails) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
   //for checking password is matching or not
     const isMatch = await bcrypt.compare(passwordId, employerDetails.password); //return boolean
    console.log('is right:',isMatch)

    if (!isMatch) {
       console.log('it is nort matched')
      return res.status(401).json({ message: 'Invalid email or password' });
    }  //res.status is provide error or not like that
  else{
     
    //employerDetails object  contains detials of the employer after verification
 const token = jwt.sign(
      { userId: employerDetails.employId,
        role:'Employer'
       },
        process.env.JWT_SECRET,
      { expiresIn: '3h' }
    );
    console.log('empName',employerDetails.personName)
    res.status(200).json({ message: 'Login successful',
      employName : employerDetails.personName,
      token ,
      jobRole:'Employer',
      empId:employerDetails.employId
    });
  }

    //generating token
   

  }
  catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}
 const loginJobSeeker = async (req,res)=>{

   console.log('this is controller Data Received',req.body)

  const {emailId,passwordId} =  req.body;  //maked sure that date sent from frontend in the same key pair name
   console.log('email',emailId)
 console.log('password',passwordId)
 if(!emailId||!passwordId){
  console.log('destructing key is not coorector')
 }
  try{
    //creating connection with mongodb
     const connection = await client.connect()

      //dataBase Connection

      const db = connection.db('QuickLook');
      //collection connection

const jobseekers = db.collection('JobSeekerDetails');

//checking and getting the object detail of user or if user is  present or not in the DB
 
 const jobseekersDetails = await jobseekers.findOne({ email :emailId });
   console.log(jobseekersDetails)
 //if data is not present
    if (!jobseekersDetails) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
   //for checking password is matching or not
     const isMatch = await bcrypt.compare(passwordId, jobseekersDetails.password); //return boolean
    console.log('is right:',isMatch)

    if (!isMatch) {
       console.log('it is nort matched')
      return res.status(401).json({ message: 'Invalid email or password' });
    }  //res.status is provide error or not like that
  else{
     
    //employerDetails object  contains detials of the employer after verification
 const token = jwt.sign(
      { userId: jobseekersDetails.JobSeekerId,
        role:'JobSeeker'
       },
        process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );
      console.log('token',token)
    console.log('JobSeekerName',jobseekersDetails.fullName)
    res.status(200).json({ message: 'Login successful',
      jobSeekerName : jobseekersDetails.fullName,
      token ,
      jobRole:'JobSeeker',
       jobSeekerId:jobseekersDetails.JobSeekerId,
       jobSeekerAddress:jobseekersDetails.address,
        jobSeekerArea:jobseekersDetails.area,
  jobSeekerCity:jobseekersDetails.city,
  jobSeekerState:jobseekersDetails.state
    });
  }

    //generating token
   

  }
  catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}
//login  part   END---------------



module.exports = {
  postEmployerDetails,
  loginEmployer,
  postJobSeekerDetails,
  loginJobSeeker
};












//next task storing the pasword as hash in backend
//so  bcrypt.hash is an asynchronus call so when to try to
//  hash u might do not know when it 
// will store at that time your original password will be stored

// during login to check the hashed password is it matching or not

// const match = await bcrypt.compare('mySecret123', storedHash); here comparison is done with help of Salt

// A salt is just a random string that gets added to the user’s plain password before hashing.
// It makes every hash unique, even if two users have the same password.

//this way multiple users having same password text will stored differently in backend has hash