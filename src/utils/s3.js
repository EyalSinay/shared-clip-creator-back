require('dotenv').config();
const fs = require('fs');
const S3 = require('aws-sdk/clients/s3');
const { doesNotThrow } = require('assert');

const bucketName = process.env.AWS_BUCKET_NAME;
const region = process.env.AWS_BUCKET_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY;
const secretAccessKey = process.env.AWS_SECRET_KEY;

const s3 = new S3({
    region,
    accessKeyId,
    secretAccessKey
});


// upload
const uploadFile = (file) => {
    const fileStream = fs.createReadStream(file.path);

    const uploadParams = {
        Bucket: bucketName,
        Body: fileStream,
        Key: file.filename
    }
    
    return s3.upload(uploadParams).promise();
}
exports.uploadToS3 = uploadFile;


// download
const getFileStream = (fileKey) => {
    const downloadParams = {
        Key: fileKey,
        Bucket: bucketName
    }

    return s3.getObject(downloadParams).createReadStream();
}
exports.downloadFromS3 = getFileStream;


// delete
const deleteFile = (fileKey) => {
    const deleteParams = {
        Key: fileKey,
        Bucket: bucketName
    }

    return s3.deleteObject(deleteParams).promise();
}
exports.deleteFileFromS3 = deleteFile;