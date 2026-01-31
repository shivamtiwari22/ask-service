import fileUpload from "../config/MulterConfig.js";


const userProfile=fileUpload("public/user")
export const userProfileUpload=userProfile.fields([{name:"profile_pic",maxCount:1}]);