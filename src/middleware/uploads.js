const multer = require('multer');

const uploadAudio = multer({
    dest: 'uploads/',
    limits: {
        fileSize: 8000000
    },
    fileFilter(req, file, cb) {
        if (!file.originalname.endsWith('.mp3')) {
            return cb(new Error('Only mp3 please'));
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
            return cb(new Error('Only mp4 please'));
        }
        cb(undefined, true)
    }
});

module.exports = {
    uploadAudio,
    uploadVideo
}