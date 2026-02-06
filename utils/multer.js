import fileUpload from "../config/MulterConfig.js";


const userProfile=fileUpload("public/user")
export const userProfileUpload=userProfile.fields([{name:"profile_pic",maxCount:1}]);

const serviceCategory=fileUpload("public/service-category")
export const serviceCategoryUpload=serviceCategory.fields([{name:"image",maxCount:1}]);