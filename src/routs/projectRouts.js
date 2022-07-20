const express = require('express');
const fs = require('fs');
var mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Project = require('../models/projectModel.js');
const { BASE_URL_FRONT } = require('../utils/global-vars.js')
const { uploadAudio, uploadVideo, uploadImage } = require('../middleware/uploads.js');
const { uploadToS3, downloadFromS3, deleteFileFromS3 } = require('../utils/s3.js');
const { getConcatVideo, removeAllAtomsFiles, videoShortens } = require('../utils/ffmpegFunctions.js');
const User = require('../models/userModel');
const router = new express.Router();

const piping = [];


// -----POST:-----
router.post('/users/projects', auth, async (req, res) => {
    const project = new Project({
        ...req.body,
        owner: req.user._id,
        sections: [],
        createdAt: new Date(),
    });
    try {
        await project.save();
        res.status(201).send(project);
    } catch (error) {
        res.status(400).send({ error: error.message });
    }
});

router.post('/users/projects/:id/audioTrack', auth, uploadAudio.single('audioTrack'), async (req, res) => {
    const _id = req.params.id;
    const file = req.file;
    const project = await Project.findOne({ _id, owner: req.user._id });
    if (!project) {
        fs.unlinkSync(file.path);
        throw new Error('error');
    }
    if (project.audioTrack) {
        const deleteAudioTrackResults = await deleteFileFromS3(project.audioTrack);
        console.log("audioTrack is deleted from s3", deleteAudioTrackResults);
    }
    // manipulate the file here...
    // if not, use: multer-s3
    const uploadResult = await uploadToS3(file);
    project.audioTrack = uploadResult.Key;
    await project.save();
    fs.unlinkSync(file.path);

    res.send('success');
}, (error, req, res, next) => {
    res.status(400).send({ error: error.message });
});

router.post('/users/projects/:id/sections', auth, async (req, res) => {
    const _id = req.params.id;
    try {
        const project = await Project.findOne({ _id, owner: req.user._id });
        if (!project) {
            throw new Error('error');
        }

        const idsDoseNotChanged = []
        for (let i = 0; i < req.body.length; i++) {
            for (let j = 0; j < project.sections.length; j++) {
                if (
                    req.body[i].targetEmail === project.sections[j].targetEmail
                    &&
                    req.body[i].secondStart === project.sections[j].secondStart
                    &&
                    req.body[i].secondEnd === project.sections[j].secondEnd) {
                    req.body[i]._id = project.sections[j]._id;
                    idsDoseNotChanged.push(project.sections[j]._id);
                }
            }
        }
        for (let sec of req.body) {
            sec._id = sec._id ? sec._id : new mongoose.Types.ObjectId();
        }

        req.body.forEach(sec => {
            sec.secLink = "/project/" + project._id + "/section/" + sec._id;
            sec.fullLink = BASE_URL_FRONT + "project/" + project._id + "/section/" + sec._id;
        });

        const preSections = [...project.sections];
        project.sections = req.body;
        await project.save();


        for (let i = 0; i < preSections.length; i++) {
            const secId = preSections[i]._id;

            if (!idsDoseNotChanged.some(id => id === secId)) {
                await User.findOneAndUpdate({ 'projectsParticipant.sectionId': secId }, {
                    $pull: {
                        projectsParticipant: {
                            sectionId: secId
                        }
                    }
                });

                if (preSections[i].videoTrack) {
                    const deleteVideoTrackResults = await deleteFileFromS3(preSections[i].videoTrack)
                    console.log("videoTrack is deleted from s3", deleteVideoTrackResults);
                }
            }
        }


        for (let sec of req.body) {
            const secId = sec._id;

            if (!idsDoseNotChanged.some(id => id === secId)) {
                const projectOwner = await project.populate('owner');
                await User.findOneAndUpdate({ email: sec.targetEmail }, {
                    $push: {
                        projectsParticipant: {
                            projectName: project.projectName,
                            projectOwnerName: projectOwner.owner.name,
                            fullLink: BASE_URL_FRONT + "project/" + project._id + "/section/" + sec._id,
                            link: "/project/" + project._id + "/section/" + sec._id,
                            sectionId: sec._id
                        }
                    }
                });
            }
        }

        res.send(project.sections);
    } catch (err) {
        res.status(400).send({ error: err.message });
    }
});


// -----GET:-----
router.get('/users/projects', auth, async (req, res) => {
    try {
        await req.user.populate('projects');
        res.send(req.user.projects);
    } catch (e) {
        res.status(500).send();
    }
});

router.get('/users/projects/:id', auth, async (req, res) => {
    const _id = req.params.id;
    try {
        const project = await Project.findOne({ _id, owner: req.user._id });
        if (!project) {
            return res.status(404).send()
        }
        res.send(project);
    } catch (e) {
        res.status(500).send();
    }
});

// ! check how to get it in front with token
router.get('/users/projects/:id/audioTrack', async (req, res) => {
    const _id = req.params.id;
    try {
        const project = await Project.findOne({ _id });
        if (!project) {
            return res.status(404).send();
        }
        const userAudioTrack = downloadFromS3(project.audioTrack);
        res.set('Content-Type', 'audio/mpeg');
        userAudioTrack.pipe(res);
    } catch (e) {
        res.status(500).send();
    }
});

// ! check how to get it in front with token
router.get('/users/projects/:id/concatVideo', async (req, res) => {
    const _id = req.params.id;
    try {
        const project = await Project.findOne({ _id, /* owner: req.user._id */ });
        if (!project) {
            return res.status(404).send()
        }
        const userAudioTrack = downloadFromS3(project.audioTrack);
        const files = [];
        for (let sec of project.sections) {
            const duration = Math.round((sec.secondEnd - sec.secondStart) * 10) / 10;
            if (sec.videoTrack) {
                const sectionVideoTrack = downloadFromS3(sec.videoTrack);
                files.push({ type: "video", file: sectionVideoTrack, duration });
            } else if (sec.image) {
                const sectionImage = downloadFromS3(sec.image);
                files.push({ type: "image", file: sectionImage, duration });
            } else {
                files.push({ type: "no-file", duration });
            }
        }
        const [clipStream, allPaths] = await getConcatVideo(userAudioTrack, files, project.allowed, project._id, project.scaleVideo);

        // ! Why sometimes after this request end, i send a delete request to delete sec-video and i get an error from aws-sdk???
        // ! How to ensure that in any case, even if the user canceled the request, the files will be deleted???
        req.on('close', () => removeAllAtomsFiles(allPaths));

        res.set('Content-Type', 'video/mp4');
        clipStream.pipe(res)
            .on('error', () => removeAllAtomsFiles(allPaths))
            .on('finish', () => removeAllAtomsFiles(allPaths));


    } catch (e) {
        removeAllAtomsFiles(allPaths);
        res.status(500).send();
    }
});

router.get('/users/projects/:id/sections/:sec', auth, async (req, res) => {
    const _id = req.params.id;
    try {
        const project = await Project.findOne({ _id, 'sections._id': req.params.sec });
        if (!project) {
            return res.status(404).send();
        }
        const section = project.sections.find(mySec => mySec._id.toString() === req.params.sec);

        if (section.secure) {
            if (req.user.email !== section.targetEmail) {
                return res.status(401).send();
            }
        }

        res.send(section);
    } catch (e) {
        res.status(500).send();
    }
});

// ! check how to get it in front with token
router.get('/users/projects/:id/sections/:sec/videoTrack', async (req, res) => {
    const _id = req.params.id;
    try {
        const project = await Project.findOne({ _id, 'sections._id': req.params.sec });
        if (!project) {
            return res.status(404).send();
        }
        const section = project.sections.find(mySec => mySec._id.toString() === req.params.sec);

        if (section.secure) {
            if (req.user.email !== section.targetEmail) {
                return res.status(404).send();
            }
        }

        if (!section.videoTrack) {
            return res.status(404).send();
        }

        const sectionVideoTrack = downloadFromS3(section.videoTrack);
        res.set('Content-Type', 'video/mp4');
        sectionVideoTrack.pipe(res);

    } catch (e) {
        res.status(500).send();
    }
});

// ! check how to get it in front with token
router.get('/users/projects/:id/sections/:sec/image', async (req, res) => {
    const _id = req.params.id;
    try {
        const project = await Project.findOne({ _id, 'sections._id': req.params.sec });
        if (!project) {
            return res.status(404).send();
        }
        const section = project.sections.find(mySec => mySec._id.toString() === req.params.sec);

        if (section.secure) {
            if (req.user.email !== section.targetEmail) {
                return res.status(404).send();
            }
        }

        if (!section.image) {
            return res.status(404).send();
        }

        const sectionVideoTrack = downloadFromS3(section.image);
        res.set('Content-Type', 'image/jpeg');
        sectionVideoTrack.pipe(res);

    } catch (e) {
        res.status(500).send();
    }
});


// -----PATCH:-----
router.patch('/users/projects/:id', auth, async (req, res) => {
    const updates = Object.keys(req.body);
    const allowedUpdates = ['projectName', 'allowed', 'varsKeys', 'scaleVideo', 'volumeAudioTrack', 'uploadFiles'];
    const isValidOperation = updates.every((update) => allowedUpdates.includes(update));
    if (!isValidOperation) {
        return res.status(400).send({ error: 'Invalid updates!' })
    }

    const _id = req.params.id;
    const project = await Project.findOne({ _id, owner: req.user._id });
    if (!project) {
        return res.status(404).send();
    }

    try {
        updates.forEach((update) => project[update] = req.body[update]);
        await project.save();
        res.send(project);
    } catch (e) {
        res.status(400).send(e)
    }
});


router.patch('/users/projects/:id/sections/:sec/videoTrack', auth, uploadVideo.single('videoTrack'), async (req, res) => {
    const _id = req.params.id;
    const file = req.file;


    const project = await Project.findOne({ _id, 'sections._id': req.params.sec });
    const pathFile = file.path;
    if (!project) {
        fs.unlinkSync(pathFile);
        return res.status(404).send();
    }
    const section = project.sections.find(mySec => mySec._id.toString() === req.params.sec);

    if (section.secure) {
        if (req.user.email !== section.targetEmail) {
            fs.unlinkSync(pathFile);
            return res.status(404).send();
        }
    }

    if (section.videoTrack) {
        const deleteVideoTrackResults = await deleteFileFromS3(section.videoTrack);
        console.log("videoTrack is deleted from s3", deleteVideoTrackResults);
    }
    if (section.image) {
        const deleteImageResults = await deleteFileFromS3(section.image);
        console.log("image is deleted from s3", deleteImageResults);
    }

    const duration = section.secondEnd - section.secondStart;
    const result = await videoShortens(duration, pathFile);

    if (result === "TO_SHORT") {
        return res.status(406).send("your video is to short");
    }

    if (result === "SHORTED") file.path += ".mp4";

    const uploadResult = await uploadToS3(file);
    section.videoTrack = uploadResult.Key;
    section.image = "";
    await project.save();

    if (result === "SHORTED") fs.unlinkSync(file.path);
    fs.unlinkSync(pathFile);

    res.send('success');
}, (error, req, res, next) => {
    res.status(400).send({ error: error.message });
});

router.patch('/users/projects/:id/sections/:sec/image', auth, uploadImage.single('image'), async (req, res) => {
    const _id = req.params.id;
    const file = req.file;


    const project = await Project.findOne({ _id, 'sections._id': req.params.sec });
    const pathFile = file.path;
    if (!project) {
        fs.unlinkSync(pathFile);
        return res.status(404).send();
    }
    const section = project.sections.find(mySec => mySec._id.toString() === req.params.sec);

    if (section.secure) {
        if (req.user.email !== section.targetEmail) {
            fs.unlinkSync(pathFile);
            return res.status(404).send();
        }
    }

    if (section.videoTrack) {
        const deleteVideoTrackResults = await deleteFileFromS3(section.videoTrack);
        console.log("videoTrack is deleted from s3", deleteVideoTrackResults);
    }
    if (section.image) {
        const deleteImageResults = await deleteFileFromS3(section.image);
        console.log("image is deleted from s3", deleteImageResults);
    }

    const uploadResult = await uploadToS3(file);
    section.image = uploadResult.Key;
    section.videoTrack = "";
    await project.save();

    fs.unlinkSync(pathFile);

    res.send('success');
}, (error, req, res, next) => {
    res.status(400).send({ error: error.message });
});


// -----DELETE:-----
router.delete('/users/projects/:id', auth, async (req, res) => {
    const _id = req.params.id;
    try {
        const project = await Project.findOne({ _id, owner: req.user._id });
        if (!project) {
            return res.status(404).send()
        }
        project.remove();
        res.status(204).send();
    } catch (e) {
        res.status(500).send();
    }
});

router.delete('/users/projects/:id/audioTrack', auth, async (req, res) => {
    const _id = req.params.id;
    try {
        const project = await Project.findOne({ _id, owner: req.user._id });
        if (!project) {
            return res.status(404).send()
        }
        const deleteAudioTrackResults = await deleteFileFromS3(project.audioTrack);
        console.log(deleteAudioTrackResults);

        project.audioTrack = "";
        project.save();

        res.status(204).send();
    } catch (e) {
        res.status(500).send();
    }
});

router.delete('/users/projects/:id/sections/:sec/videoTrack', auth, async (req, res) => {
    const _id = req.params.id;
    try {

        const project = await Project.findOne({ _id, 'sections._id': req.params.sec });
        if (!project) {
            return res.status(404).send();
        }
        const section = project.sections.find(mySec => mySec._id.toString() === req.params.sec);


        if (section.secure) {
            if (req.user.email !== section.targetEmail) {
                return res.status(404).send();
            }
        }

        if (section.videoTrack) {
            const deleteFileResults = await deleteFileFromS3(section.videoTrack);
            console.log("file is deleted from s3", deleteFileResults);
        }
        if (section.image) {
            const deleteFileResults = await deleteFileFromS3(section.image);
            console.log("file is deleted from s3", deleteFileResults);
        }

        section.videoTrack = "";
        section.image = "";
        project.save();

        res.status(204).send();

    } catch (e) {
        res.status(500).send();
    }
});



module.exports = router;