const mongoose = require('mongoose');
const validator = require('validator');
const { deleteFileFromS3 } = require('../utils/s3.js');
// const User = require('./userModel.js');

//! ref participant to project  
const Section = new mongoose.Schema({
    secName: { type: String, default: "sec" },
    projectName: String,
    targetEmail: {
        type: String,
        trim: true,
        lowercase: true,
        validate(value) {
            if (!validator.isEmail(value) && value !== "") {
                throw new Error('Email is invalid');
            }
        }
    },
    targetPhon: {
        type: String,
        validate(value) {
            if (!validator.isMobilePhone(value) && value !== "") {
                throw new Error('Phone number is invalid');
            }
        }
    },
    secure: { type: Boolean, default: false },
    allowedWatch: { type: Boolean, default: false },
    secLink: String,
    fullLink: String,
    secondStart: { type: Number, required: true, default: 0 },
    secondEnd: { type: Number, required: true, default: 0 },
    seenByOwner: { type: Boolean, default: false },
    seenByParticipant: { type: Boolean, default: false },
    vars: [{ key: String, value: String }],
    color: String,
    videoTrack: String,
    image: String,
    lastActiveAt: Date,
});

const projectSchema = new mongoose.Schema({
    projectName: { // unique only for this owner (pre('validate'))
        type: String,
        required: true,
    },
    scaleVideo: { type: String, default: "1920x1080" },
    audioTrack: String,
    sections: [Section],
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    varsKeys: [],
    massage: String,
    allowed: { type: Boolean, default: false },
    createdAt: { type: Date, required: true },
    lastActiveAt: Date,
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
    for (const sec of projectObject.sections) {
        delete sec.videoTrack;
    }
    return projectObject;
}

// unique name to section in project
projectSchema.pre('validate', async function (next) {
    const project = this;

    // unique secName
    // const sorted_arr = project.sections.map(sec => sec.secName).sort();
    // for (let i = 1; i < sorted_arr.length; i++) {
    //     if (sorted_arr[i] === sorted_arr[i - 1]) {
    //         next(new Error('secName must be unique'));
    //     }
    // }

    if (project.__v === undefined) {
        const allProjectsByThisOwner = await Project.find({ owner: project.owner });
        if (allProjectsByThisOwner.some(projectByThisOwner => projectByThisOwner.projectName === project.projectName)) {
            next(new Error('projectName must be unique'));
        }
    }

    next();
});

projectSchema.pre('save', function (next) {
    const project = this;
    project.lastActiveAt = new Date();
    next();
});

Section.pre('save', function (next) {
    const Section = this;
    Section.lastActiveAt = new Date();
    next();
});

projectSchema.pre('validate', function (next) {
    const sections = this.sections;

    for (let i = 1; i < sections.length; i++) {
        if (sections[i - 1].secondEnd > sections[i].secondStart) {
            next(new Error('pre.secondEnd > current.secondStart'));
        }
    }

    sections.forEach(sec => {
        if (sec.secondEnd < sec.secondStart) {
            next(new Error('sec.secondEnd < sec.secondStart'));
        }
    });

    next();
});

Section.pre('remove', async function (next) {
    const section = this;
    if (section.videoTrack) {
        const deleteVideoTrackResults = await deleteFileFromS3(section.videoTrack);
        console.log("videoTrack is deleted from s3", deleteVideoTrackResults);
    }
    if (section.image) {
        const deleteImageResults = await deleteFileFromS3(section.image);
        console.log("image is deleted from s3", deleteImageResults);
    }

    next();
});

projectSchema.pre('remove', async function (next) {
    const project = this;
    if (project.audioTrack) {
        const deleteAudioTrackResults = await deleteFileFromS3(project.audioTrack);
        console.log("audioTrack is deleted from s3", deleteAudioTrackResults);
    }
    next();
});

const Project = mongoose.model('Project', projectSchema);
module.exports = Project;