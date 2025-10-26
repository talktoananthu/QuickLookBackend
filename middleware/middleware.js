// middleware/middleware.js
 const validateLogin = (req, res, next) => {
  console.log('here it is middleware',req.body)
  //Note while destructing the if the req.body is an object 
  // then field name should also be given as same while destrcuting
  const { emailId, passwordId } = req.body;
  
  

  if (!emailId || !passwordId) {
    console.log('error in fields')
    return res.status(400).json({ message: 'Email and password are required' });
  }

  // to check format:
  
 

  next(); //
};
module.exports = {
  validateLogin
};
