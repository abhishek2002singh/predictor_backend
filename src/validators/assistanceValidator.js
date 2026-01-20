const validator = require('validator')

const createAssistantValidation = (data)=>{
    const errors = {}

    const emailId = data?.emailId?.trim() || ""
    const password = data?.password || ""
    const firstName = data?.firstName?.trim() || ""
    const lastName = data?.lastName?.trim() || ""
    const mobileNumber = data?.mobileNumber?.trim() || ""

    if (!validator.isEmail(emailId)) {
        
    }
    if (!validator.firstName) {
        
    }

}