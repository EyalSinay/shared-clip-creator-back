const multer = require('multer');

const uploadAudio = multer({
    dest: 'uploads/',
    limits: {
        fileSize: 8000000
    },
    fileFilter(req, file, cb) {
        if (!file.originalname.endsWith('.mp3')) {
            return cb(new Error('File types are accepted: mp3'));
        }
        cb(undefined, true)
    }
});

const uploadVideo = multer({
    dest: 'uploads/',
    limits: {
        fileSize: 50000000
    },
    fileFilter(req, file, cb) {
        if (!file.originalname.endsWith('.mp4')) {
            return cb(new Error('File types are accepted: mp4'));
        }
        cb(undefined, true)
    }
});

const uploadImage = multer({
    dest: 'uploads/',
    limits: {
        fileSize: 5000000
    },
    fileFilter(req, file, cb) {
        if (!file.originalname.endsWith('.jpg')
            &&
            !file.originalname.endsWith('.jpeg')
        ) {
            return cb(new Error('File types are accepted: jpg, jpeg'));
        }
        cb(undefined, true)
    }
});

module.exports = {
    uploadAudio,
    uploadVideo,
    uploadImage
}