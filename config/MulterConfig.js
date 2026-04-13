import path from "path";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import  minioClient from "../config/minio.js";
const BUCKET = "public";


const uploadToMinio = async (file, folder) => {

    const cleanFolder = folder.replace(/^public\//, "");

  const fileName = `${cleanFolder}/${Date.now()}-${file.filename}`;

  await minioClient.fPutObject(
    BUCKET,
    fileName,
    file.path,
    {
      "Content-Type": file.mimetype,
    }
  );

  // delete local file
  fs.unlinkSync(file.path);

  // return fileName;
       return `public/${fileName}`;
};


const storage = (uploadPath) =>
    multer.diskStorage({
        destination: function (req, file, cb) {
            if (!fs.existsSync(uploadPath)) {
                fs.mkdirSync(uploadPath, { recursive: true });
            }
            cb(null, uploadPath);
        },
        filename: function (req, file, cb) {
            const uniqueSuffix = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
            cb(null, uniqueSuffix);
        },
    });

const upload = (uploadPath) => multer({ storage: storage(uploadPath) });



const fileUpload = (uploadPath) => {
  const uploadMiddleware = upload(uploadPath);

  return {
    fields: (fields) => async (req, res, next) => {
      uploadMiddleware.fields(fields)(req, res, async (err) => {
        if (err) return next(err);

        try {
          // 🔥 Upload each file to MinIO
          for (const key in req.files) {
            const files = req.files[key];

            for (let file of files) {
              const minioPath = await uploadToMinio(file, uploadPath);

              // ✅ overwrite path (IMPORTANT)
              file.path = minioPath;
            }
          }

          next();
        } catch (error) {
          next(error);
        }
      });
    },

    any: () => async (req, res, next) => {
      uploadMiddleware.any()(req, res, async (err) => {
        if (err) return next(err);

        try {
          for (let file of req.files) {
            const minioPath = await uploadToMinio(file, uploadPath);
            file.path = minioPath;
          }

          next();
        } catch (error) {
          next(error);
        }
      });
    },
  };
};




// const fileUpload = (uploadPath) => {
//     const uploadMiddleware = upload(uploadPath);

//     return {
//         fields: (fields) => async (req, res, next) => {
//             uploadMiddleware.fields(fields)(req, res, (err) => {
//                 if (err) {
//                     return next(err);
//                 }
//                 next();
//             });
//         },
//         any: () => async (req, res, next) => {
//             uploadMiddleware.any()(req, res, (err) => {
//                 if (err) {
//                     return next(err);
//                 }
//                 next();
//             });
//         },
//     };
// };





export default fileUpload;
