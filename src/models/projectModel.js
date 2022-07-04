const mongoose = require('mongoose');
const validator = require('validator');
const { deleteFileFromS3 } = require('../utils/s3.js');


const Section = new mongoose.Schema({
    secName: { type: String, unique: true, required: true },
    targetName: String,
    targetEmail: {
        type: String,
        trim: true,
        lowercase: true,
        validate(value) {
            if (!validator.isEmail(value)) {
                throw new Error('Email is invalid')
            }
        }
    },
    targetPhon: {
        type: String,
        validate(value) {
            if (!validator.isMobilePhone(value)) {
                throw new Error('Phone number is invalid')
            }
        }
    },
    secure: Boolean,
    secondStart: { type: Number, required: true },
    secondEnd: { type: Number, required: true },
    message: String,
    videoTrack: String,
});
//! validate: secondEnd > secondStart
//! pre('save'): sort array by seconds

const projectSchema = new mongoose.Schema({
    projectName: {
        type: String,
        required: true,
        unique: true,
    },
    audioTrack: String,
    sections: [Section],
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    allowed: Boolean
});

Section.methods.toJSON = function () {
    const section = this;
    const sectionObject = section.toObject();
    delete sectionObject.videoTrack;
    return sectionObject;
}

projectSchema.methods.toJSON = function () {
    const project = this;
    const projectObject = project.toObject();
    delete projectObject.audioTrack;
    //! delete videosTracks
    return projectObject;
}

Section.pre('remove', async function (next) {
    const section = this;
    if (section.videoTrack) {
        const deleteVideoTrackResults = await deleteFileFromS3(section.videoTrack);
        console.log("videoTrack is deleted from s3", deleteVideoTrackResults);
    }
    next();
});

projectSchema.pre('remove', async function (next) {
    const project = this;
    if (project.audioTrack) {
        const deleteVideoTrackResults = await deleteFileFromS3(project.audioTrack);
        console.log("audioTrack is deleted from s3", deleteVideoTrackResults);
    }
    next();
});

const Project = mongoose.model('Project', projectSchema);
module.exports = Project;