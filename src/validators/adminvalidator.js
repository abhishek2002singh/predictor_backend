const validator = require("validator");

const adminSignupValidator = (data) => {
  const errors = {};

  const firstName = data.firstName?.trim() || "";
  const lastName = data.lastName?.trim() || "";
  const emailId = data.emailId?.trim() || "";
  const password = data.password || "";

  if (!validator.isLength(firstName, { min: 2, max: 50 })) {
    errors.firstName = "First name must be between 2 and 50 characters";
  }

  if (!validator.isLength(lastName, { min: 2, max: 50 })) {
    errors.lastName = "Last name must be between 2 and 50 characters";
  }

  if (!data.mobileNumber) {
    errors.mobileNumber = "Mobile number is required";
  } else if (!validator.isMobilePhone(data.mobileNumber, "en-IN")) {
    errors.mobileNumber = "Invalid mobile number";
  }

  if (!validator.isEmail(emailId)) {
    errors.emailId = "Valid email is required";
  }

  if (!validator.isLength(password, { min: 6 })) {
    errors.password = "Password must be at least 6 characters long";
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
  };
};

const adminLoginValidator = (data)=>{
  const errors = {}

  const emailId = data.emailId?.trim() || "";
  const password = data.password || "";

  if (!validator.isEmail(emailId)) {
    errors.emailId = "Valid email is required";
  }

  if (!validator.isLength(password, { min: 6 })) {
    errors.password = "Password must be at least 6 characters long";
  }

   return {
    errors,
    isValid: Object.keys(errors).length === 0,
  };

}

const assistanceLogin =(data)=>{
   const errors = {}

  const emailId = data.emailId?.trim() || "";
  const password = data.password || "";

  if (!validator.isEmail(emailId)) {
    errors.emailId = "Valid email is required";
  }

  if (!validator.isLength(password, { min: 6 })) {
    errors.password = "Password must be at least 6 characters long";
  }

   return {
    errors,
    isValid: Object.keys(errors).length === 0,
  };
}
module.exports = { adminSignupValidator  , adminLoginValidator ,assistanceLogin };
